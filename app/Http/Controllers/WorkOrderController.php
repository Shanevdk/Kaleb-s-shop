<?php

namespace App\Http\Controllers;

use App\Enums\EstimateStatus;
use App\Http\Requests\WorkOrderRequest;
use App\Http\Resources\WorkOrderResource;
use App\Mail\WorkOrderMail;
use App\Models\ServiceRecord;
use Illuminate\Http\RedirectResponse;
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
     * link is signed, so it only opens the job it was made for.
     */
    public function show(ServiceRecord $serviceRecord): Response
    {
        $serviceRecord->load('vehicle', 'parts.inventoryItem', 'inspectionItem');

        return Inertia::render('work-order', [
            'companyName' => config('app.name'),
            'sheet' => WorkOrderResource::make($serviceRecord)->resolve(),
        ]);
    }

    /**
     * Save what is wrong, and email the sheet when given an address. A sheet
     * still missing its time or a part's price has the AI work them out
     * again, for a job saved before it priced parts or one it failed on.
     */
    public function update(WorkOrderRequest $request, ServiceRecord $serviceRecord): RedirectResponse
    {
        $serviceRecord->update($request->safe()->only(['issue_reason']));

        $serviceRecord->load('vehicle', 'parts.inventoryItem', 'inspectionItem');

        if ($serviceRecord->estimate_status !== EstimateStatus::Pending
            && ($serviceRecord->estimated_hours === null || $serviceRecord->partsEstimate()['unpriced'] > 0)) {
            $serviceRecord->estimateAgain();
        }

        $email = $request->string('email')->trim()->toString();

        if ($email === '') {
            Inertia::flash('toast', ['type' => 'success', 'message' => __('Work order saved.')]);

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
