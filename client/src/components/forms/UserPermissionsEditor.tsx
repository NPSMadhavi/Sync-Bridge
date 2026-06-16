import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  MODULE_DEFINITIONS,
  type UserPermissionsMap,
  setAllPermissions,
} from "@shared/permissions";

interface UserPermissionsEditorProps {
  value: UserPermissionsMap;
  onChange: (permissions: UserPermissionsMap) => void;
  disabled?: boolean;
}

export default function UserPermissionsEditor({
  value,
  onChange,
  disabled = false,
}: UserPermissionsEditorProps) {
  const toggleModule = (key: keyof UserPermissionsMap, checked: boolean) => {
    onChange({ ...value, [key]: checked });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-semibold">Module Access</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Select which modules this user can access.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(setAllPermissions(true, value))}
        >
          Select All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(setAllPermissions(false, value))}
        >
          Clear All
        </Button>
        <div className="flex items-center gap-2 ml-auto sm:ml-2">
          <Label htmlFor="can-see-other-data" className="font-normal cursor-pointer whitespace-nowrap">
            Can See Other Data
          </Label>
          <Switch
            id="can-see-other-data"
            checked={value.canSeeOtherData === true}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({ ...value, canSeeOtherData: checked === true })
            }
            className="data-[state=checked]:bg-cyan-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-4">
        {MODULE_DEFINITIONS.map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-2">
            <Checkbox
              id={`module-${key}`}
              checked={value[key] === true}
              disabled={disabled}
              onCheckedChange={(checked) => toggleModule(key, checked === true)}
            />
            <Label htmlFor={`module-${key}`} className="font-normal cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
