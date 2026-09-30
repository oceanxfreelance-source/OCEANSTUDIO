import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card, options, Select, TextArea, TextField } from "@/components/admin/ui";
import { DELIVERY_STATUS_LABEL, PAYMENT_STATUS_LABEL, SESSION_STATUS_LABEL, TIME_SLOTS } from "@/lib/constants";
import { dateInputValue } from "@/lib/format";
import type { FormState } from "@/lib/forms";

export type SessionValues = {
  customerId: string;
  serviceId: string | null;
  locationText: string;
  date: Date | null;
  time: string | null;
  people: number | null;
  clips: number | null;
  price: { toString(): string } | null;
  paymentStatus: string;
  status: string;
  deliveryStatus: string;
  deliveryLink: string | null;
  notes: string;
  bookingId: string | null;
};

export function SessionForm({
  action,
  values,
  customers,
  services,
  isNew,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  values: SessionValues;
  customers: { id: string; name: string; instagram: string | null }[];
  services: { id: string; name: string }[];
  isNew: boolean;
}) {
  const v = values;
  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="bookingId" value={v.bookingId ?? ""} />
      <div className="space-y-6">
        <Card title="Session">
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Customer"
              name="customerId"
              required
              defaultValue={v.customerId}
              options={[{ value: "", label: "Choose…" }, ...customers.map((c) => ({ value: c.id, label: c.instagram ? `${c.name} (@${c.instagram})` : c.name }))]}
            />
            <Select label="Service" name="serviceId" defaultValue={v.serviceId ?? ""} options={[{ value: "", label: "—" }, ...services.map((s) => ({ value: s.id, label: s.name }))]} />
            <TextField label="Location" name="locationText" defaultValue={v.locationText} placeholder="e.g. Machines" />
            <TextField label="Date" name="date" type="date" required defaultValue={dateInputValue(v.date)} />
            <TextField label="Time" name="time" list="time-slots" defaultValue={v.time ?? ""} placeholder="e.g. Sunrise or 06:30" />
            <datalist id="time-slots">
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Surfers / people" name="people" type="number" min={0} defaultValue={v.people ?? ""} />
              <TextField label="Clips" name="clips" type="number" min={0} defaultValue={v.clips ?? ""} />
            </div>
          </div>
          <TextArea label="Notes" name="notes" rows={3} defaultValue={v.notes} className="mt-5" hint="Private — conditions, gear, anything to remember." />
        </Card>
        <Card title="Digital delivery">
          <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
            <TextField label="Delivery link" name="deliveryLink" type="url" defaultValue={v.deliveryLink ?? ""} placeholder="https://drive.google.com/…" hint="Google Drive / Dropbox / WeTransfer folder with the files. The customer doesn't need an account." />
            <Select label="Delivery status" name="deliveryStatus" defaultValue={v.deliveryStatus} options={options(DELIVERY_STATUS_LABEL)} />
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Status">
          <div className="space-y-4">
            <Select label="Session status" name="status" defaultValue={v.status} options={options(SESSION_STATUS_LABEL)} />
            <TextField label="Price (USD)" name="price" inputMode="decimal" defaultValue={v.price?.toString() ?? ""} />
            <Select label="Payment" name="paymentStatus" defaultValue={v.paymentStatus} options={options(PAYMENT_STATUS_LABEL)} hint="Sessions marked Paid count towards revenue." />
          </div>
        </Card>
        <SubmitButton className="w-full">{isNew ? "Create session" : "Save changes"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
