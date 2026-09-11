<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class VerifyUserAccount extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:verify-account {email : The email address of the account to verify}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mark an account as verified so it can sign in without a verification email';

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

        if ($user->email_verified_at !== null) {
            $this->info("{$email} was already verified.");

            return self::SUCCESS;
        }

        $user->forceFill(['email_verified_at' => now()])->save();

        $this->info("{$email} is verified and can now sign in.");

        return self::SUCCESS;
    }
}
