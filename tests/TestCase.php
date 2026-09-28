<?php

namespace Tests;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * Check the database before RefreshDatabase gets the chance to wipe it.
     *
     * The trait's own `beforeRefreshingDatabase` hook cannot hold the check:
     * a trait method wins over one inherited from here, so it would silently
     * replace it.
     */
    protected function setUpTraits(): array
    {
        if ($this->usesRefreshDatabase()) {
            $this->guardAgainstWipingTheWorkingDatabase(DB::connection()->getDatabaseName());
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
     * RefreshDatabase is about to drop every table it can see, so a
     * misconfigured DB_DATABASE is the difference between a test run and
     * losing the shop's records. Failing loudly here is cheap; the
     * alternative is not recoverable.
     */
    private function guardAgainstWipingTheWorkingDatabase(string $name): void
    {
        if (! str_ends_with($name, '_testing')) {
            $this->fail(
                "Refusing to run: the suite drops every table, and [{$name}] is not a test database. "
                .'Test database names must end in `_testing`. Check DB_DATABASE in phpunit.xml '
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
