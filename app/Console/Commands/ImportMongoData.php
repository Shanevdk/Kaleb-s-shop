<?php

namespace App\Console\Commands;

use DateTimeInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use MongoDB\BSON\Decimal128;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Database;
use MongoDB\Laravel\Connection as MongoConnection;
use RuntimeException;
use Throwable;

class ImportMongoData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:import-mongodb
                            {--dry-run : Copy everything, report what happened, then roll it all back}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Copy the shop records out of the old MongoDB store into the SQL database';

    /**
     * The collections to copy, parents before children, with the table each
     * foreign key column points at.
     *
     * Sessions, cache entries and queued jobs are left behind: everyone signs
     * in again and nothing is lost.
     *
     * @var array<string, array<string, string>>
     */
    private const TABLES = [
        'users' => [],
        'vehicles' => ['user_id' => 'users'],
        'inventory_items' => ['user_id' => 'users'],
        'service_records' => ['user_id' => 'users', 'vehicle_id' => 'vehicles'],
        'inspections' => ['user_id' => 'users', 'vehicle_id' => 'vehicles'],
        'inspection_items' => ['inspection_id' => 'inspections'],
        'fitments' => ['inventory_item_id' => 'inventory_items', 'vehicle_id' => 'vehicles'],
        'service_record_parts' => ['service_record_id' => 'service_records', 'inventory_item_id' => 'inventory_items'],
        'stock_movements' => [
            'user_id' => 'users',
            'inventory_item_id' => 'inventory_items',
            'vehicle_id' => 'vehicles',
            'service_record_id' => 'service_records',
        ],
        'passkeys' => ['user_id' => 'users'],
    ];

    /**
     * The new key given to each MongoDB document, by table and old id.
     *
     * @var array<string, array<string, string>>
     */
    private array $keys = [];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (DB::connection()->getDriverName() === 'mongodb') {
            $this->error('The default connection is still MongoDB. Point DB_CONNECTION at the SQL database first.');

            return self::FAILURE;
        }

        $occupied = array_filter(array_keys(self::TABLES), fn (string $table): bool => DB::table($table)->exists());

        if ($occupied !== []) {
            $this->error('Refusing to import: these tables already have records: '.implode(', ', $occupied).'.');

            return self::FAILURE;
        }

        $connection = DB::connection('mongodb');

        if (! $connection instanceof MongoConnection) {
            $this->error('The [mongodb] connection does not use the MongoDB driver.');

            return self::FAILURE;
        }

        $source = $connection->getDatabase();

        $this->info("Copying from MongoDB database [{$source->getDatabaseName()}] into [".DB::connection()->getDatabaseName().'].');

        $summary = [];

        DB::beginTransaction();

        try {
            foreach (self::TABLES as $table => $foreignKeys) {
                $summary[] = [$table, ...$this->copy($source, $table, $foreignKeys)];
            }
        } catch (Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }

        $this->table(['Table', 'In MongoDB', 'Copied', 'Skipped'], $summary);

        if ($this->option('dry-run')) {
            DB::rollBack();
            $this->warn('Dry run: nothing was saved.');

            return self::SUCCESS;
        }

        DB::commit();
        $this->info('Import complete.');

        return self::SUCCESS;
    }

    /**
     * Copy one collection into its table.
     *
     * @param  array<string, string>  $foreignKeys
     * @return array{int, int, int}
     */
    private function copy(Database $source, string $table, array $foreignKeys): array
    {
        $columns = collect(Schema::getColumns($table))->keyBy('name');
        $generatesKeys = $columns->get('id')['auto_increment'] ?? false;
        $found = $copied = 0;
        $ignored = [];

        $documents = $source->selectCollection($table)->find([], [
            'typeMap' => ['root' => 'array', 'document' => 'array', 'array' => 'array'],
        ]);

        foreach ($documents as $document) {
            if (! is_array($document)) {
                continue;
            }

            $found++;
            $oldId = (string) $document['_id'];
            $row = [];

            if (! $generatesKeys) {
                $row['id'] = $this->keys[$table][$oldId] = $this->newKeyFor($document['_id']);
            }

            foreach ($document as $field => $value) {
                if ($field === '_id' || $field === 'id') {
                    continue;
                }

                if (! $columns->has($field)) {
                    $ignored[$field] = true;

                    continue;
                }

                if (isset($foreignKeys[$field])) {
                    $value = $value === null ? null : ($this->keys[$foreignKeys[$field]][(string) $value] ?? null);

                    if ($value === null && ! $columns[$field]['nullable']) {
                        $this->warn("  Skipped {$table} [{$oldId}]: its {$field} points at nothing.");

                        continue 2;
                    }

                    $row[$field] = $value;

                    continue;
                }

                $value = $this->convert($value, $columns[$field]['type_name']);

                // Leave the column out so its default applies rather than
                // forcing a null into a column that does not take one.
                if ($value === null && ! $columns[$field]['nullable']) {
                    continue;
                }

                $row[$field] = $value;
            }

            try {
                DB::table($table)->insert($row);
            } catch (Throwable $exception) {
                throw new RuntimeException("Could not copy {$table} [{$oldId}]: {$exception->getMessage()}", previous: $exception);
            }

            $copied++;
        }

        if ($ignored !== []) {
            $this->line("  {$table}: left out fields with no column: ".implode(', ', array_keys($ignored)).'.');
        }

        return [$found, $copied, $found - $copied];
    }

    /**
     * Make a ULID that sorts where the document was created.
     */
    private function newKeyFor(mixed $id): string
    {
        $createdAt = $id instanceof ObjectId
            ? Carbon::createFromTimestamp($id->getTimestamp())
            : null;

        return strtolower((string) Str::ulid($createdAt));
    }

    /**
     * Turn a BSON value into what the column expects.
     */
    private function convert(mixed $value, string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof UTCDateTime) {
            $value = Carbon::instance($value->toDateTime());
        }

        if ($value instanceof Decimal128 || $value instanceof ObjectId) {
            $value = (string) $value;
        }

        return match (true) {
            in_array($type, ['int2', 'int4', 'int8'], true) => is_numeric($value) ? (int) $value : null,
            $type === 'numeric' => is_numeric($value) ? (string) $value : null,
            $type === 'bool' => (bool) $value,
            $type === 'date' => $this->toCarbon($value)?->toDateString(),
            str_starts_with($type, 'timestamp') => $this->toCarbon($value)?->format('Y-m-d H:i:s'),
            in_array($type, ['json', 'jsonb'], true) => is_string($value) && json_validate($value)
                ? $value
                : json_encode($value, JSON_THROW_ON_ERROR),
            default => is_array($value) ? json_encode($value, JSON_THROW_ON_ERROR) : (string) $value,
        };
    }

    /**
     * Read a date that may have been stored as a date or as text.
     */
    private function toCarbon(mixed $value): ?Carbon
    {
        if ($value instanceof DateTimeInterface) {
            return Carbon::instance($value);
        }

        return is_string($value) && $value !== '' ? Carbon::parse($value) : null;
    }
}
