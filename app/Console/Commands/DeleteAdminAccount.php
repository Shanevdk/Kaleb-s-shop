<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class DeleteAdminAccount extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:delete-admin {email? : The email address of the account to delete (defaults to ADMIN_EMAIL)}
                            {--force : Delete without asking for confirmation}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete an administrator account along with everything it has logged';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = strtolower(trim((string) ($this->argument('email') ?? config('app.admin.email'))));

        if ($email === '') {
            $this->error('Pass an email, or set ADMIN_EMAIL in .env.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();

        if (! $user instanceof User) {
            $this->error("No account found for {$email}.");

            return self::FAILURE;
        }

        if (! $user->is_admin) {
            $this->error("{$email} is not an administrator, so it was left alone.");

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm("Delete {$email} and all of its vehicles, records and stock?")) {
            $this->line('Nothing was deleted.');

            return self::SUCCESS;
        }

        $user->delete();

        $this->info("Deleted {$email}.");

        return self::SUCCESS;
    }
}
