<?php

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;

class CreateAdminAccount extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:create-admin {email? : The email address to sign in with (defaults to ADMIN_EMAIL)}
                            {--password= : The password to sign in with (defaults to ADMIN_PASSWORD)}
                            {--name= : The name shown in the app (defaults to ADMIN_NAME)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a verified shop administrator account, or reset an existing one';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = strtolower(trim((string) ($this->argument('email') ?? config('app.admin.email'))));
        $password = (string) ($this->option('password') ?? config('app.admin.password'));

        if ($email === '' || $password === '') {
            $this->error('Pass an email and --password, or set ADMIN_EMAIL and ADMIN_PASSWORD in .env.');

            return self::FAILURE;
        }

        $user = User::firstOrNew(['email' => $email]);
        $isNew = ! $user->exists;

        // Force filled rather than mass assigned: `role` is deliberately left
        // out of the model's fillable attributes.
        $user->forceFill([
            'name' => $this->option('name') ?? ($isNew ? config('app.admin.name') : $user->name),
            'password' => $password,
            'role' => UserRole::Admin,
            'status' => AccountStatus::Approved,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->info($isNew
            ? "Created administrator account {$email}."
            : "{$email} already existed, so it is now an administrator with the new password.");

        return self::SUCCESS;
    }
}
