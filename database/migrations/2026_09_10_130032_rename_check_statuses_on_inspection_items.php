<?php

use App\Models\InspectionItem;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The checklist now offers good, needs attention and fixed rather than
     * pass, watch and fail, so the items already checked off are moved onto
     * the wording the buttons use.
     */
    public function up(): void
    {
        InspectionItem::where('status', 'pass')->update(['status' => 'good']);
        InspectionItem::where('status', 'fail')->update(['status' => 'fixed']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        InspectionItem::where('status', 'good')->update(['status' => 'pass']);
        InspectionItem::where('status', 'fixed')->update(['status' => 'fail']);
    }
};
