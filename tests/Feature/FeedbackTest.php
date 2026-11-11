<?php

use App\Enums\Permission;
use App\Mail\FeedbackMail;
use App\Models\Feedback;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

test('guests cannot send feedback', function () {
    $this->post(route('feedback.store'), ['message' => 'The scanner is broken.'])
        ->assertRedirect(route('login'));

    expect(Feedback::count())->toBe(0);
});

test('anyone on the team can send feedback, which is kept and emailed to the admins with replies going to the sender', function () {
    Mail::fake();
    $admin = User::factory()->admin()->create(['email' => 'shane@example.com']);
    $grantedTeam = User::factory()->create(['email' => 'lead@example.com', 'permissions' => [Permission::ManageTeam->value]]);
    $mechanic = User::factory()->create(['email' => 'mechanic@example.com']);
    $shopper = User::factory()->shopper()->create(['name' => 'Kaleb', 'email' => 'kaleb@example.com']);

    $this->actingAs($shopper)
        ->post(route('feedback.store'), [
            'message' => 'Ticking a part off the list does nothing.',
            'page' => '/shopping-list',
        ])
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'Thanks, the admins have it. They will reply to kaleb@example.com.');

    $feedback = Feedback::sole();

    expect($feedback->user_id)->toBe($shopper->id)
        ->and($feedback->message)->toBe('Ticking a part off the list does nothing.')
        ->and($feedback->page)->toBe('/shopping-list')
        ->and($feedback->resolved_at)->toBeNull();

    Mail::assertQueued(FeedbackMail::class, 1);
    Mail::assertQueued(FeedbackMail::class, function (FeedbackMail $mail) use ($admin, $grantedTeam, $mechanic): bool {
        $mail->assertSeeInHtml('Ticking a part off the list does nothing.')
            ->assertSeeInHtml(url('/shopping-list'));

        return $mail->hasTo($admin->email)
            && $mail->hasTo($grantedTeam->email)
            && ! $mail->hasTo($mechanic->email)
            && $mail->hasReplyTo('kaleb@example.com', 'Kaleb')
            && $mail->hasSubject('Feedback from Kaleb')
            && $mail->connection === 'deferred';
    });
});

test('the feedback email shows what was typed as plain text', function () {
    $feedback = Feedback::factory()->create(['message' => '<script>alert(1)</script> [click](https://evil.example)']);

    (new FeedbackMail($feedback, $feedback->user))
        ->assertDontSeeInHtml('<script>alert(1)</script>', false)
        ->assertDontSeeInHtml('>click</a>', false)
        ->assertSeeInHtml('[click](https://evil.example)', false);
});

test('feedback needs a message', function () {
    Mail::fake();

    $this->actingAs(User::factory()->create())
        ->post(route('feedback.store'), ['message' => '  '])
        ->assertSessionHasErrors(['message' => 'The message field is required.']);

    expect(Feedback::count())->toBe(0);
    Mail::assertNothingQueued();
});

test('the page sent with feedback must be a page in the app', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('feedback.store'), [
            'message' => 'Broken.',
            'page' => 'https://evil.example/login',
        ])
        ->assertSessionHasErrors(['page' => 'The page field format is invalid.']);

    expect(Feedback::count())->toBe(0);
});

test('mechanics cannot see or resolve feedback', function () {
    $feedback = Feedback::factory()->create();
    $mechanic = User::factory()->create();

    $this->actingAs($mechanic)
        ->get(route('admin.feedback.index'))
        ->assertForbidden();

    $this->actingAs($mechanic)
        ->patch(route('admin.feedback.update', $feedback), ['resolved' => true])
        ->assertForbidden();

    expect($feedback->fresh()->resolved_at)->toBeNull();
});

test('an admin sees open feedback apart from resolved feedback', function () {
    $sender = User::factory()->create(['name' => 'Kaleb', 'email' => 'kaleb@example.com']);
    $open = Feedback::factory()->for($sender)->create(['message' => 'The scanner will not open.']);
    $resolved = Feedback::factory()->resolved()->create();

    $this->actingAs(User::factory()->admin()->create())
        ->get(route('admin.feedback.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/feedback/index')
            ->where('openFeedback', 1)
            ->has('open', 1)
            ->where('open.0.id', $open->id)
            ->where('open.0.message', 'The scanner will not open.')
            ->where('open.0.sender', ['name' => 'Kaleb', 'email' => 'kaleb@example.com'])
            ->where('open.0.is_resolved', false)
            ->has('resolved', 1)
            ->where('resolved.0.id', $resolved->id)
            ->where('resolved.0.is_resolved', true)
        );
});

test('only admins are told how much feedback is waiting', function () {
    Feedback::factory()->count(2)->create();

    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->where('openFeedback', 0));
});

test('an admin can mark feedback resolved and open it again', function () {
    $this->freezeSecond();
    $admin = User::factory()->admin()->create();
    $feedback = Feedback::factory()->create();

    $this->actingAs($admin)
        ->patch(route('admin.feedback.update', $feedback), ['resolved' => true])
        ->assertRedirect();

    expect($feedback->fresh()->resolved_at?->toDateTimeString())->toBe(now()->toDateTimeString());

    $this->actingAs($admin)
        ->patch(route('admin.feedback.update', $feedback), ['resolved' => false])
        ->assertRedirect();

    expect($feedback->fresh()->resolved_at)->toBeNull();
});
