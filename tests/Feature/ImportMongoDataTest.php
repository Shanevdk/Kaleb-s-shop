<?php

use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use MongoDB\BSON\Decimal128;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Database;

/**
 * Get the MongoDB database the import reads from, refusing anything that is
 * not a test database since every test empties it.
 */
function mongo(): Database
{
    /** @var Database $database */
    $database = DB::connection('mongodb')->getDatabase();

    if (! str_ends_with($database->getDatabaseName(), '_testing')) {
        test()->fail("Refusing to clear [{$database->getDatabaseName()}]: it is not a test database.");
    }

    return $database;
}

/**
 * Empty the collections the import copies.
 */
function clearMongo(): void
{
    foreach (['users', 'vehicles', 'inventory_items', 'service_records', 'inspections', 'inspection_items', 'fitments', 'service_record_parts', 'stock_movements', 'passkeys'] as $collection) {
        mongo()->dropCollection($collection);
    }
}

/**
 * Put a user with a vehicle, a job and a stocked part into MongoDB, shaped the
 * way the old models wrote them.
 *
 * @return array<string, ObjectId>
 */
function seedMongoShop(): array
{
    $ids = [
        'user' => new ObjectId,
        'vehicle' => new ObjectId,
        'record' => new ObjectId,
        'item' => new ObjectId,
    ];

    $at = new UTCDateTime(strtotime('2026-09-10 14:30:00') * 1000);

    mongo()->selectCollection('users')->insertOne([
        '_id' => $ids['user'],
        'name' => 'Kaleb',
        'email' => 'kaleb@example.com',
        'password' => bcrypt('password'),
        'is_admin' => true,
        'email_verified_at' => $at,
        'created_at' => $at,
        'updated_at' => $at,
    ]);

    mongo()->selectCollection('vehicles')->insertOne([
        '_id' => $ids['vehicle'],
        'user_id' => (string) $ids['user'],
        'make' => 'Kubota',
        'model' => 'L3901',
        'year' => '2019',
        'odometer' => '',
        'kind' => 'tractor',
        'specs' => '{"source":"manual","engine":{"cylinders":3}}',
        'created_at' => $at,
        'updated_at' => $at,
    ]);

    mongo()->selectCollection('service_records')->insertOne([
        '_id' => $ids['record'],
        'user_id' => (string) $ids['user'],
        'vehicle_id' => (string) $ids['vehicle'],
        'title' => 'Oil change',
        'type' => 'oil_change',
        'status' => 'completed',
        'performed_on' => new UTCDateTime(strtotime('2026-09-01 00:00:00') * 1000),
        'hours' => new Decimal128('1.50'),
        'parts_cost' => new Decimal128('42.10'),
        'labour_cost' => new Decimal128('0'),
        'created_at' => $at,
        'updated_at' => $at,
    ]);

    mongo()->selectCollection('inventory_items')->insertOne([
        '_id' => $ids['item'],
        'user_id' => (string) $ids['user'],
        'name' => 'Engine oil',
        'category' => 'fluids',
        'unit' => 'litre',
        'barcode' => '0123456789',
        'quantity' => new Decimal128('7.50'),
        'minimum_quantity' => new Decimal128('2'),
        'unit_cost' => new Decimal128('8.99'),
        'created_at' => $at,
        'updated_at' => $at,
    ]);

    mongo()->selectCollection('stock_movements')->insertOne([
        '_id' => new ObjectId,
        'user_id' => (string) $ids['user'],
        'inventory_item_id' => (string) $ids['item'],
        'vehicle_id' => (string) $ids['vehicle'],
        'service_record_id' => (string) $ids['record'],
        'quantity' => new Decimal128('-4.5'),
        'note' => 'Oil change',
        'created_at' => $at,
        'updated_at' => $at,
    ]);

    return $ids;
}

beforeEach(fn () => clearMongo());
afterEach(fn () => clearMongo());

test('the import copies every record and keeps them linked to each other', function () {
    seedMongoShop();

    $this->artisan('app:import-mongodb')->assertSuccessful();

    $user = User::sole();
    $vehicle = Vehicle::sole();
    $record = ServiceRecord::sole();
    $item = InventoryItem::sole();
    $movement = StockMovement::sole();

    expect($user->email)->toBe('kaleb@example.com')
        ->and($user->is_admin)->toBeTrue()
        ->and($user->created_at->toDateTimeString())->toBe('2026-09-10 14:30:00')
        ->and($vehicle->user_id)->toBe($user->id)
        ->and($vehicle->year)->toBe(2019)
        ->and($vehicle->odometer)->toBeNull()
        ->and($vehicle->engine()['cylinders'])->toBe(3)
        ->and($record->vehicle_id)->toBe($vehicle->id)
        ->and($record->performed_on->toDateString())->toBe('2026-09-01')
        ->and($record->total_cost)->toBe(42.10)
        ->and($item->quantity)->toBe('7.50')
        ->and($item->barcode)->toBe('0123456789')
        ->and($movement->inventory_item_id)->toBe($item->id)
        ->and($movement->service_record_id)->toBe($record->id)
        ->and($movement->quantity)->toBe('-4.50');
});

test('the import can sign the copied user in with their old password', function () {
    seedMongoShop();

    $this->artisan('app:import-mongodb')->assertSuccessful();

    $this->post(route('login'), [
        'email' => 'kaleb@example.com',
        'password' => 'password',
    ])->assertSessionHasNoErrors();

    $this->assertAuthenticatedAs(User::sole());
});

test('the import skips records whose owner is gone and drops links to missing context', function () {
    $ids = seedMongoShop();

    mongo()->selectCollection('vehicles')->insertOne([
        '_id' => new ObjectId,
        'user_id' => (string) new ObjectId,
        'make' => 'Orphan',
        'model' => 'Nobody',
        'year' => 2000,
    ]);

    mongo()->selectCollection('stock_movements')->updateMany([], ['$set' => ['vehicle_id' => (string) new ObjectId]]);

    $this->artisan('app:import-mongodb')->assertSuccessful();

    expect(Vehicle::pluck('make')->all())->toBe(['Kubota'])
        ->and(StockMovement::sole()->vehicle_id)->toBeNull()
        ->and(StockMovement::sole()->inventory_item_id)->not->toBeNull();
});

test('a dry run reports the import without saving any of it', function () {
    seedMongoShop();

    $this->artisan('app:import-mongodb', ['--dry-run' => true])
        ->expectsOutputToContain('Dry run')
        ->assertSuccessful();

    expect(User::count())->toBe(0)
        ->and(Vehicle::count())->toBe(0);
});

test('the import refuses to run into a database that already has records', function () {
    seedMongoShop();
    $existing = User::factory()->create();

    $this->artisan('app:import-mongodb')->assertFailed();

    expect(User::sole()->is($existing))->toBeTrue()
        ->and(Vehicle::count())->toBe(0);
});
