import { LocationPicker } from './integrated/LocationPicker'

/**
 * Address form component.
 * Wraps the full-featured LocationPicker (GPS, map click, reverse geocode).
 * 
 * @param {Object} props
 * @param {Object} props.initialValue - { address, lat, lng, label }
 * @param {function} props.onChange - Callback with { address, lat, lng, label }
 * @param {string} [props.label] - Label text for the picker
 * @param {boolean} [props.showMap] - Whether to show the interactive map (default true)
 */
export function AddressForm({ initialValue, onChange, label = 'Location', showMap = true }) {
  const handleChange = (loc) => {
    onChange?.({
      address: loc.address || '',
      lat: loc.lat || 0,
      lng: loc.lng || 0,
      label: initialValue?.label || 'Home',
    })
  }

  return (
    <LocationPicker
      value={{
        address: initialValue?.address || '',
        lat: initialValue?.lat || '',
        lng: initialValue?.lng || '',
      }}
      onChange={handleChange}
      label={label}
      placeholder="House / Street, Area, City, State"
      showMap={showMap}
    />
  )
}


