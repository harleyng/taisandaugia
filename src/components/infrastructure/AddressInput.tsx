import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { vietnamProvinces } from '@/constants/vietnam-locations'

export interface AddressValue {
  address: string
  ward: string
  district: string
  province: string
}

interface Props {
  value: AddressValue
  onChange: (val: AddressValue) => void
  required?: boolean
}

export function AddressInput({ value, onChange, required }: Props) {
  const [province, setProvince] = useState(value.province)
  const [district, setDistrict] = useState(value.district)
  const [ward, setWard] = useState(value.ward)

  const provinceData = useMemo(
    () => vietnamProvinces.find((p) => p.name === province),
    [province],
  )
  const districtData = useMemo(
    () => provinceData?.districts.find((d) => d.name === district),
    [provinceData, district],
  )

  function handleProvince(val: string) {
    setProvince(val)
    setDistrict('')
    setWard('')
    onChange({ ...value, province: val, district: '', ward: '' })
  }

  function handleDistrict(val: string) {
    setDistrict(val)
    setWard('')
    onChange({ ...value, district: val, ward: '' })
  }

  function handleWard(val: string) {
    setWard(val)
    onChange({ ...value, ward: val })
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>
          Địa chỉ{required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Số nhà, tên đường..."
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>
            Tỉnh/TP{required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select value={province} onValueChange={handleProvince}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Chọn tỉnh/TP" />
            </SelectTrigger>
            <SelectContent>
              {vietnamProvinces.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Quận/Huyện</Label>
          <Select
            value={district}
            onValueChange={handleDistrict}
            disabled={!provinceData}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Chọn quận/huyện" />
            </SelectTrigger>
            <SelectContent>
              {(provinceData?.districts ?? []).map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Phường/Xã</Label>
          <Select
            value={ward}
            onValueChange={handleWard}
            disabled={!districtData}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Chọn phường/xã" />
            </SelectTrigger>
            <SelectContent>
              {(districtData?.wards ?? []).map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
