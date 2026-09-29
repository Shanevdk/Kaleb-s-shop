<?php

namespace App\Enums;

/**
 * Where something on the schedule stands.
 */
enum ScheduledCheckStatus: string
{
    case Done = 'done';
    case InProgress = 'in_progress';
    case Due = 'due';
    case Overdue = 'overdue';
    case Upcoming = 'upcoming';
    case Missed = 'missed';
}
