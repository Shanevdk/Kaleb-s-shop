<?php

namespace App\Jobs;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\EstimateJobDuration;
use App\Enums\EstimateStatus;
use App\Models\ServiceRecord;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Works out how long a job will take, after the page that saved it has gone
 * back, so saving stays instant while the model thinks it over.
 */
class EstimateServiceRecordDuration implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     *
     * @param  string  $fingerprint  what the job looked like when it was saved
     */
    public function __construct(public ServiceRecord $serviceRecord, public string $fingerprint)
    {
        $this->onConnection('deferred');
    }

    /**
     * Execute the job.
     */
    public function handle(EstimateJobDuration $estimateJobDuration): void
    {
        // Running inside the web request, so give the free models, and the
        // fallbacks behind them, longer than a page load gets.
        set_time_limit(300);

        if ($this->isStale()) {
            return;
        }

        try {
            $estimate = $estimateJobDuration->estimate($this->serviceRecord);
        } catch (AssistantUnavailable $exception) {
            report($exception);
            $this->markFailed();

            return;
        }

        // The job may have been edited while the model was thinking; a newer
        // estimate is already on its way for that.
        if ($this->isStale()) {
            return;
        }

        $this->serviceRecord->forceFill([
            'estimate_status' => EstimateStatus::Ready,
            'estimated_hours' => $estimate['hours'],
            'estimated_hours_low' => $estimate['low'],
            'estimated_hours_high' => $estimate['high'],
            'estimate_reasoning' => $estimate['reasoning'] !== '' ? $estimate['reasoning'] : null,
            'estimated_at' => now(),
        ])->saveQuietly();
    }

    /**
     * Stop the job waiting on an estimate that is never coming.
     */
    public function failed(?Throwable $exception): void
    {
        $this->markFailed();
    }

    /**
     * Determine whether the job has changed, or gone, since this estimate
     * was asked for.
     */
    private function isStale(): bool
    {
        $current = $this->serviceRecord->fresh();

        if ($current === null) {
            return true;
        }

        $this->serviceRecord = $current;

        return $current->estimateFingerprint() !== $this->fingerprint;
    }

    /**
     * Record that no estimate came, unless the job has moved on since.
     */
    private function markFailed(): void
    {
        if (! $this->isStale()) {
            $this->serviceRecord->forceFill(['estimate_status' => EstimateStatus::Failed])->saveQuietly();
        }
    }
}
