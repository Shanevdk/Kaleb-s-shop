<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeUserAdmin extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:make-admin {email : The email address of the account to promote}
                            {--revoke : Take administrator access away instead of granting it}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Grant or revoke shop administrator access for an account';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::where('email', $email)->first();

        if (! $user instanceof User) {
            $this->error("No account found for {$email}.");

            return self::FAILURE;
        }

        $isAdmin = ! $this->option('revoke');
        $attributes = ['is_admin' => $isAdmin];

        // No mail is configured, so an unverified account could never get past
        // the `verified` middleware to use the access being granted.
        if ($isAdmin && $user->email_verified_at === null) {
            $attributes['email_verified_at'] = now();
            $this->line("Marked {$email} as verified.");
        }

        $user->forceFill($attributes)->save();

        $this->info($user->is_admin
            ? "{$email} is now a shop administrator."
            : "{$email} is no longer a shop administrator.");

        return self::SUCCESS;
    }
}
