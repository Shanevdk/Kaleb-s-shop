<?php

use App\Enums\EstimateStatus;
use App\Enums\UnitOfMeasure;
use App\Jobs\EstimateServiceRecordDuration;
use App\Mail\WorkOrderMail;
use App\Models\InspectionItem;
use App\Models\InventoryItem;
use App\Models\ServiceRecord;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Mailer\Exception\TransportException;

/**
 * A planned brake job with an AI time estimate, a written reason, and one
 * part each priced off the shelf, priced by the AI and not priced at all.
 */
function brakeJob(): ServiceRecord
{
    $vehicle = Vehicle::factory()->create([
        'year' => 2019,
        'make' => 'Ford',
        'model' => 'Ranger',
        'nickname' => 'Blue ute',
        'registration' => 'ABCD 123',
    ]);

    $record = ServiceRecord::factory()->planned()->for($vehicle)->create([
        'title' => 'Front brake pads',
        'odometer' => 142000,
        'hours' => 6,
        'parts_cost' => 999,
        'labour_cost' => 250,
        'description' => 'Internal only: driver keeps riding the brakes.',
        'issue_reason' => 'Front pads are down to 2mm and grinding.',
    ]);

    $record->forceFill([
        'estimate_status' => EstimateStatus::Ready,
        'estimated_hours' => 2.5,
        'estimated_hours_low' => 2,
        'estimated_hours_high' => 3,
    ])->saveQuietly();

    $cleaner = InventoryItem::factory()->create(['name' => 'Brake cleaner', 'unit_cost' => 45]);
    $record->parts()->create(['inventory_item_id' => $cleaner->id, 'name' => 'Brake cleaner', 'quantity' => 2, 'unit' => UnitOfMeasure::Each]);
    $record->parts()->create(['name' => 'Front brake pad set', 'quantity' => 1, 'unit' => UnitOfMeasure::Each])
        ->forceFill(['estimated_unit_cost' => 120])
        ->save();
    $record->parts()->create(['name' => 'Caliper slide pin kit', 'quantity' => 1, 'unit' => UnitOfMeasure::Each]);

    return $record;
}

test('anyone with the link can open the work order without logging in', function () {
    $record = brakeJob();

    $this->get($record->workOrderUrl())
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('work-order')
            ->where('sheet.title', 'Front brake pads')
            ->where('sheet.reason', 'Front pads are down to 2mm and grinding.')
            ->where('sheet.vehicle.name', '2019 Ford Ranger')
            ->where('sheet.vehicle.registration', 'ABCD 123')
            ->where('sheet.vehicle.odometer', 142000)
            ->where('sheet.time', ['hours' => 2.5, 'low' => 2, 'high' => 3])
            ->missing('sheet.description')
        );
});

test('the cost adds up the parts at stock prices, or the AI price for parts not on the shelf, with no labour', function () {
    $record = brakeJob();

    $response = $this->get($record->workOrderUrl())
        ->assertInertia(fn ($page) => $page->where('sheet.cost', ['total' => 210, 'unpriced' => 1]));

    $parts = collect($response->inertiaProps('sheet.parts'))->keyBy('name');

    expect($parts['Brake cleaner'])->toMatchArray(['price_each' => 45, 'line_total' => 90, 'priced_by' => 'shelf'])
        ->and($parts['Front brake pad set'])->toMatchArray(['line_total' => 120, 'priced_by' => 'estimate'])
        ->and($parts['Caliper slide pin kit'])->toMatchArray(['line_total' => null, 'priced_by' => null]);
});

test('a part renamed to something else loses the price the AI gave the old one', function () {
    $record = brakeJob();
    $pads = $record->parts()->where('name', 'Front brake pad set')->first();

    $pads->update(['name' => 'Rear brake pad set']);

    expect($pads->fresh()->estimated_unit_cost)->toBeNull();
});

test('the work order will not open without a valid signature', function () {
    $record = brakeJob();

    $this->get(route('work-orders.show', $record))->assertForbidden();
    $this->get($record->workOrderUrl().'x')->assertForbidden();
});

test('a link signed for one job cannot be pointed at another', function () {
    $record = brakeJob();
    $other = ServiceRecord::factory()->create();

    $tampered = str_replace($record->id, $other->id, $record->workOrderUrl());

    $this->get($tampered)->assertForbidden();
});

test('without a written reason the sheet says what was flagged on the checklist', function () {
    $item = InspectionItem::factory()->create(['label' => 'Wiper blades', 'notes' => 'Smearing badly']);
    $record = ServiceRecord::factory()->planned()->create(['inspection_item_id' => $item->id]);

    $this->get($record->workOrderUrl())
        ->assertInertia(fn ($page) => $page->where('sheet.reason', 'Wiper blades: Smearing badly'));
});

test('without a written reason or checklist item the sheet uses the job notes, minus the time estimate line', function () {
    $record = ServiceRecord::factory()->planned()->create([
        'description' => "Estimated time: 2 hours (2–3 hrs range) — Pads.\n\nPedal goes to the floor.",
    ]);

    $this->get($record->workOrderUrl())
        ->assertInertia(fn ($page) => $page->where('sheet.reason', 'Pedal goes to the floor.'));
});

test('the repair time is only ever the AI estimate, never the hours logged against the job', function () {
    $record = ServiceRecord::factory()->planned()->create(['hours' => 6]);

    $this->get($record->workOrderUrl())
        ->assertInertia(fn ($page) => $page->where('sheet.time', null));
});

test('the job page hands out a link that opens its work order', function () {
    $record = brakeJob();

    $response = $this->actingAs(User::factory()->create())
        ->get(route('service-records.show', $record))
        ->assertInertia(fn ($page) => $page
            ->where('workOrder.sheet.reason', 'Front pads are down to 2mm and grinding.')
            ->where('workOrder.sheet.cost.total', 210)
            ->has('workOrder.url')
        );

    auth()->logout();

    $this->get($response->inertiaProps('workOrder.url'))->assertOk();
});

test('saving the work order stores the reason without sending anything', function () {
    Mail::fake();
    $record = brakeJob();

    $this->actingAs(User::factory()->create())
        ->put(route('service-records.work-order.update', $record), ['issue_reason' => 'Rear tyres are below the legal tread depth.'])
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'Work order saved.');

    expect($record->fresh()->issue_reason)->toBe('Rear tyres are below the legal tread depth.');
    Mail::assertNothingSent();
});

test('saving a sheet with a part still unpriced has the AI work the estimate out again', function () {
    Queue::fake();
    $record = brakeJob();
    config(['services.openrouter.key' => 'test-key']);

    $this->actingAs(User::factory()->create())
        ->put(route('service-records.work-order.update', $record), ['issue_reason' => 'Pads worn.'])
        ->assertRedirect();

    expect($record->fresh()->estimate_status)->toBe(EstimateStatus::Pending);
    Queue::assertPushed(EstimateServiceRecordDuration::class, 1);
});

test('saving a sheet that is fully worked out does not ask the AI again', function () {
    Queue::fake();
    $record = brakeJob();
    $record->parts()->where('name', 'Caliper slide pin kit')->delete();
    config(['services.openrouter.key' => 'test-key']);

    $this->actingAs(User::factory()->create())
        ->put(route('service-records.work-order.update', $record), ['issue_reason' => 'Pads worn.'])
        ->assertRedirect();

    Queue::assertNothingPushed();
});

test('the work order can be emailed, with replies going to whoever sent it', function () {
    Mail::fake();
    $sender = User::factory()->create(['name' => 'Kaleb', 'email' => 'kaleb@example.com']);
    $record = brakeJob();

    $this->actingAs($sender)
        ->put(route('service-records.work-order.update', $record), [
            'issue_reason' => 'Rear tyres are below the legal tread depth.',
            'email' => 'manager@example.com',
            'message' => 'Here is what we found.',
        ])
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'Work order emailed to manager@example.com.');

    Mail::assertSent(WorkOrderMail::class, function (WorkOrderMail $mail) use ($record): bool {
        $mail->assertSeeInHtml('Rear tyres are below the legal tread depth.')
            ->assertSeeInHtml('Here is what we found.')
            ->assertSeeInHtml('$210.00 + 1 unpriced')
            ->assertSeeInHtml('≈ $120.00', false)
            ->assertSeeInHtml('2 h–3 h', false)
            ->assertSeeInHtml(e($record->workOrderUrl()), false)
            ->assertDontSeeInHtml('$250.00')
            ->assertDontSeeInHtml('riding the brakes');

        // The link is also written out as clickable text, for mail apps that
        // drop the button.
        $link = preg_quote(e($record->workOrderUrl()), '#');
        expect($mail->render())->toMatch("#<a href=\"{$link}\"[^>]*>{$link}</a>#");

        return $mail->hasTo('manager@example.com')
            && $mail->hasReplyTo('kaleb@example.com')
            && $mail->hasSubject('Work order: Front brake pads, 2019 Ford Ranger');
    });
});

test('a sheet that could not be emailed is still saved, and the sender is told', function () {
    Mail::shouldReceive('to->send')->andThrow(new TransportException('Connection refused'));
    $record = brakeJob();

    $this->actingAs(User::factory()->create())
        ->put(route('service-records.work-order.update', $record), [
            'issue_reason' => 'Rear tyres are below the legal tread depth.',
            'email' => 'manager@example.com',
        ])
        ->assertRedirect()
        ->assertInertiaFlash('toast.type', 'error');

    expect($record->fresh()->issue_reason)->toBe('Rear tyres are below the legal tread depth.');
});

test('the work order needs a reason and a real email address', function () {
    Mail::fake();
    $record = brakeJob();

    $this->actingAs(User::factory()->create())
        ->put(route('service-records.work-order.update', $record), [
            'issue_reason' => '',
            'email' => 'not-an-email',
        ])
        ->assertSessionHasErrors([
            'issue_reason' => 'The what is wrong field is required.',
            'email',
        ]);

    expect($record->fresh()->issue_reason)->toBe('Front pads are down to 2mm and grinding.');
    Mail::assertNothingSent();
});

test('a shopper cannot change or send a work order', function () {
    Mail::fake();
    $record = brakeJob();

    $this->actingAs(User::factory()->shopper()->create())
        ->put(route('service-records.work-order.update', $record), [
            'issue_reason' => 'Pads worn.',
            'email' => 'manager@example.com',
        ])
        ->assertForbidden();

    Mail::assertNothingSent();
});
