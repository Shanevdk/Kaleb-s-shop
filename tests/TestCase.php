<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * Migrate before RefreshDatabase gets the chance to.
     *
     * Two MongoDB quirks make `migrate:fresh` unusable here. It drops the whole
     * database, which the server does in the background, so the migrations that
     * follow race the drop and fail. And migrating leaves the connection's
     * client null, which unlike Laravel's SQL drivers it never restores, so the
     * transaction RefreshDatabase opens next dies on it.
     *
     * Dropping the collections one by one is synchronous, and reconnecting
     * afterwards leaves the trait with nothing to do but its transaction.
     */
    protected function setUpTraits(): array
    {
        if (! RefreshDatabaseState::$migrated && $this->usesRefreshDatabase()) {
            $database = DB::connection()->getDatabase();

            $this->guardAgainstWipingTheWorkingDatabase($database->getDatabaseName());

            foreach ($database->listCollectionNames() as $collection) {
                $database->dropCollection($collection);
            }

            $this->artisan('migrate');
            $this->app[Kernel::class]->setArtisan(null);

            // `reconnect()` only refreshes PDO handles, which MongoDB has none
            // of; purging drops the dead instance so the next resolve builds a
            // connection with a live client.
            DB::purge();

            RefreshDatabaseState::$migrated = true;
        }

        return parent::setUpTraits();
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }

    /**
     * Refuse to run unless the connected database is clearly a test database.
     *
     * The next thing this class does is drop every collection it can see, so
     * a misconfigured MONGODB_DATABASE is the difference between a test run
     * and losing the shop's records. Failing loudly here is cheap; the
     * alternative is not recoverable.
     */
    private function guardAgainstWipingTheWorkingDatabase(string $name): void
    {
        if (! str_ends_with($name, '_testing')) {
            $this->fail(
                "Refusing to run: the suite drops every collection, and [{$name}] is not a test database. "
                .'Test database names must end in `_testing`. Check MONGODB_DATABASE in phpunit.xml '
                .'and that no environment variable is overriding it.'
            );
        }
    }

    /**
     * Determine whether the test wants a freshly migrated database.
     */
    private function usesRefreshDatabase(): bool
    {
        return in_array(RefreshDatabase::class, class_uses_recursive(static::class), true);
    }
}
