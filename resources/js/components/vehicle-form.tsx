import { Form, Link } from '@inertiajs/react';
import VehicleController from '@/actions/App/Http/Controllers/VehicleController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { index } from '@/routes/vehicles';
import type { Vehicle } from '@/types';

export default function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
    const action = vehicle
        ? VehicleController.update.form(vehicle.id)
        : VehicleController.store.form();

    return (
        <Form {...action} className="space-y-8">
            {({ processing, errors }) => (
                <>
                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Identity
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="make">Make</Label>
                                <Input
                                    id="make"
                                    name="make"
                                    defaultValue={vehicle?.make ?? ''}
                                    placeholder="Toyota"
                                    required
                                    autoFocus
                                />
                                <InputError message={errors.make} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="model">Model</Label>
                                <Input
                                    id="model"
                                    name="model"
                                    defaultValue={vehicle?.model ?? ''}
                                    placeholder="Hilux"
                                    required
                                />
                                <InputError message={errors.model} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="year">Year</Label>
                                <Input
                                    id="year"
                                    name="year"
                                    type="number"
                                    inputMode="numeric"
                                    min={1900}
                                    max={new Date().getFullYear() + 1}
                                    defaultValue={vehicle?.year ?? ''}
                                    placeholder="2018"
                                    required
                                />
                                <InputError message={errors.year} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="nickname">
                                    Nickname{' '}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </Label>
                                <Input
                                    id="nickname"
                                    name="nickname"
                                    defaultValue={vehicle?.nickname ?? ''}
                                    placeholder="Work ute"
                                />
                                <InputError message={errors.nickname} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="colour">Colour</Label>
                                <Input
                                    id="colour"
                                    name="colour"
                                    defaultValue={vehicle?.colour ?? ''}
                                    placeholder="Gunmetal grey"
                                />
                                <InputError message={errors.colour} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            Registration &amp; condition
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="registration">Plate</Label>
                                <Input
                                    id="registration"
                                    name="registration"
                                    defaultValue={vehicle?.registration ?? ''}
                                    placeholder="ABC123"
                                    className="uppercase"
                                />
                                <InputError message={errors.registration} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="vin">VIN</Label>
                                <Input
                                    id="vin"
                                    name="vin"
                                    defaultValue={vehicle?.vin ?? ''}
                                    placeholder="JT123456789012345"
                                    className="uppercase"
                                />
                                <InputError message={errors.vin} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="odometer">Odometer (km)</Label>
                                <Input
                                    id="odometer"
                                    name="odometer"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    defaultValue={vehicle?.odometer ?? ''}
                                    placeholder="128000"
                                />
                                <InputError message={errors.odometer} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                defaultValue={vehicle?.notes ?? ''}
                                placeholder="Known issues, owner preferences, parts fitted."
                            />
                            <InputError message={errors.notes} />
                        </div>
                    </section>

                    <div className="flex items-center gap-3 border-t pt-6">
                        <Button type="submit" disabled={processing}>
                            {vehicle ? 'Save changes' : 'Add vehicle'}
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href={index()}>Cancel</Link>
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
