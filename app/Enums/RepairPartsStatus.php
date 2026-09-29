<?php

namespace App\Enums;

/**
 * Where working out the parts for a flagged checklist item has got to.
 */
enum RepairPartsStatus: string
{
    case Pending = 'pending';
    case Planned = 'planned';
    case NoneNeeded = 'none_needed';
    case Failed = 'failed';
}
