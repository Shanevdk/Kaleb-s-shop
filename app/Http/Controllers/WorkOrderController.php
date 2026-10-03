<?php

namespace App\Http\Controllers;

use App\Http\Requests\WorkOrderRequest;
use App\Http\Resources\WorkOrderResource;
use App\Mail\WorkOrderMail;
use App\Models\ServiceRecord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

/**
 * A job written up to share: what is wrong, the parts it takes, and what it
 * should cost and how long it should take, both worked out automatically.
 * Anyone with the link can open it, and it can be emailed from the job.
 */
class WorkOrderController extends Controller
{
    /**
     * Show the work order to whoever has the link. No login needed; the
     * link is signed, so it only opens the job it was made for, and carries
     * the job's current key, so a link shared before the last reset is dead.
     */
    public function show(Request $request, ServiceRecord $serviceRecord): Response
    {
        abort_unless(
            $serviceRecord->work_order_key !== null && hash_equals($serviceRecord->work_order_key, (string) $request->query('key')),
            403,
        );

        $serviceRecord->load('vehicle', 'parts.inventoryItem', 'inspectionItem');

        return Inertia::render('work-order', [
            'companyName' => config('app.name'),
            'sheet' => WorkOrderResource::make($serviceRecord)->resolve(),
        ]);
    }

    /**
     * Save what is wrong and the price, if one is set by hand in place of the
     * worked-out cost, and email the sheet when given an address. A sheet
     * still missing its time or a part's price has the AI work them out
     * again, for a job saved before it priced parts or one it failed on.
     */
    public function update(WorkOrderRequest $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        if ($request->boolean('reset_link')) {
            $serviceRecord->resetWorkOrderLink();

            Inertia::flash('toast', ['type' => 'success', 'message' => __('Work order link reset. Links shared before now no longer open.')]);

            return back();
        }

        $serviceRecord->update($request->safe()->only(['issue_reason', 'quoted_price']));

        $serviceRecord->load('vehicle', 'parts.inventoryItem', 'inspectionItem');

        if (! $serviceRecord->isAwaitingEstimate()
            && ($serviceRecord->estimated_hours === null || $serviceRecord->partsEstimate()['unpriced'] > 0)) {
            $serviceRecord->estimateAgain();
        }

        $email = $request->string('email')->trim()->toString();

        if ($email === '') {
            Inertia::flash('toast', ['type' => 'success', 'message' => __('Work order saved.')]);

            return back();
        }

        // The log mailer only writes the email to a file, so saying it was
        // sent would be untrue.
        if (config('mail.default') === 'log') {
            Inertia::flash('toast', ['type' => 'warning', 'message' => __('Work order saved, but email is not set up on this site yet, so nothing was sent. Copy the link and send it yourself.')]);

            return back();
        }

        try {
            Mail::to($email)->send(new WorkOrderMail(
                $serviceRecord,
                $request->user(),
                $request->string('message')->trim()->toString(),
            ));
        } catch (TransportExceptionInterface $exception) {
            report($exception);

            Inertia::flash('toast', ['type' => 'error', 'message' => __('Work order saved, but the email could not be sent. Copy the link and send it yourself.')]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Work order emailed to :email.', ['email' => $email])]);

        return back();
    }
}
