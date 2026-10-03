---
paths:
    - 'app/Http/Controllers/Equipment*.php'
---

# Controllers

## Equipment is split by division; authorize every single-equipment action

equipment.division (EquipmentDivision: main = VDK-Equipment, usa = VDK Equipment USA) partitions equipment; checklists and service records follow their equipment (inDivision scopes). List pages are registered once per division by $equipmentLists in routes/web.php (USA under usa/ with usa. route names, division passed as a route default) — add new list routes there and to divisionRoutes in resources/js/lib/equipment-divisions.ts. Routes for a single piece of equipment are shared by both divisions and their group middleware only checks viewAny (any division), so every such action must authorize through the division-aware policies (Gate::authorize or the FormRequest's authorize).
