<?php

namespace App\Jobs;

use App\Actions\PlanRepairFromInspection;
use App\Enums\RepairPartsStatus;
use App\Models\InspectionItem;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Plans the repair for a checklist item that was just flagged. It runs on
 * the deferred connection, after the response has gone back, so tapping
 * "Needs attention" stays instant while the model thinks it over.
 */
class PlanRepairForFlaggedItem implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(public InspectionItem $item, public User $user)
    {
        $this->onConnection('deferred');
    }

    /**
     * Execute the job.
     */
    public function handle(PlanRepairFromInspection $planRepair): void
    {
        // The plan keeps its own time budget; this is headroom on top so PHP
        // never cuts the answer off.
        set_time_limit(90);

        $planRepair->handle($this->item, $this->user);
    }

    /**
     * Stop the checklist waiting on a plan that is never coming.
     */
    public function failed(?Throwable $exception): void
    {
        $this->item->update(['parts_status' => RepairPartsStatus::Failed]);
    }
}
