<?php

namespace App\Enums;

/**
 * Where the AI's estimate of how long a job will take has got to.
 */
enum EstimateStatus: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Failed = 'failed';
}
