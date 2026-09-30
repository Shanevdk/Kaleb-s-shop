<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The app used to run on UTC and now runs on the shop's own time zone.
     * Timestamp columns hold wall-clock time with no zone attached, so every
     * time saved so far is rewritten from UTC into the shop's time, keeping
     * each one the same moment.
     */
    public function up(): void
    {
        $this->convert('UTC', (string) config('app.timezone'));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->convert((string) config('app.timezone'), 'UTC');
    }

    /**
     * Rewrite every zoneless timestamp column from one time zone to another.
     */
    private function convert(string $from, string $to): void
    {
        if (DB::getDriverName() !== 'pgsql' || $from === $to) {
            return;
        }

        $columns = DB::table('information_schema.columns')
            ->where('table_schema', DB::raw('current_schema()'))
            ->where('data_type', 'timestamp without time zone')
            ->get(['table_name', 'column_name'])
            ->groupBy('table_name');

        foreach ($columns as $table => $tableColumns) {
            $assignments = $tableColumns
                ->map(fn (object $column): string => sprintf(
                    '"%1$s" = ("%1$s" AT TIME ZONE ?) AT TIME ZONE ?',
                    $column->column_name,
                ))
                ->implode(', ');

            $bindings = $tableColumns->flatMap(fn (): array => [$from, $to])->all();

            DB::update("UPDATE \"{$table}\" SET {$assignments}", $bindings);
        }
    }
};
