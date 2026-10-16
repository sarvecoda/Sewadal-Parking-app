import type { ReactNode } from 'react'
import { formatVehicleNumber } from '../plateFormat'
import type { VehicleForm } from '../types'
import { BusyLabel } from './LoadingSpinner'
import { ModalFrame } from './ModalFrame'

type Props = {
  title: string
  titleId: string
  form: VehicleForm
  onChange: (patch: Partial<VehicleForm>) => void
  /** Runs after the plate field is formatted on blur. */
  onPlateBlur?: (formattedPlate: string) => void
  error: string | null
  /** Shown above the fields, e.g. “already saved” panel. */
  notice?: ReactNode
  hint?: ReactNode
  busy: boolean
  saving: boolean
  saveDisabled?: boolean
  onSave: () => void
  onClose: () => void
}

/** Shared Add / Edit vehicle form (name, plate, mobile, model). */
export function VehicleFormModal({
  title,
  titleId,
  form,
  onChange,
  onPlateBlur,
  error,
  notice,
  hint,
  busy,
  saving,
  saveDisabled = false,
  onSave,
  onClose,
}: Props) {
  return (
    <ModalFrame title={title} titleId={titleId} onClose={onClose} locked={busy}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice}
      <div className="modal-fields">
        <label className="field-label field-label--modal">
          Name
          <input
            className="field-input"
            value={form.entry1}
            onChange={(e) => onChange({ entry1: e.target.value })}
          />
        </label>
        <label className="field-label field-label--modal">
          Vehicle number
          <input
            className="field-input"
            value={form.entry2}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => onChange({ entry2: e.target.value })}
            onBlur={() => {
              const formatted = formatVehicleNumber(form.entry2)
              onChange({ entry2: formatted })
              onPlateBlur?.(formatted)
            }}
          />
        </label>
        <label className="field-label field-label--modal">
          Mobile
          <input
            className="field-input"
            inputMode="tel"
            value={form.entry3}
            onChange={(e) => onChange({ entry3: e.target.value })}
          />
        </label>
        <label className="field-label field-label--modal">
          Model
          <input
            className="field-input"
            value={form.entry4}
            onChange={(e) => onChange({ entry4: e.target.value })}
          />
        </label>
      </div>
      {hint ? <p className="modal-hint modal-hint--tight">{hint}</p> : null}
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={busy || saveDisabled}
        >
          <BusyLabel busy={saving} busyText="Saving…">
            Save
          </BusyLabel>
        </button>
      </div>
    </ModalFrame>
  )
}
