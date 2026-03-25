import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { Organization } from "@/types/organization.types";
import { OrganizationStatusBadge } from "@/components/admin/OrganizationStatusBadge";
import { cn } from "@/lib/utils";

interface OrganizationSwitcherProps {
  organizations: Organization[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string) => void;
}

export const OrganizationSwitcher = ({
  organizations,
  selectedOrgId,
  onSelectOrg,
}: OrganizationSwitcherProps) => {
  const [open, setOpen] = useState(false);

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedOrg ? selectedOrg.name : "Chọn tổ chức..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-background" align="start">
        <Command>
          <CommandInput placeholder="Tìm kiếm tổ chức..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy tổ chức.</CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => {
                    onSelectOrg(org.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOrgId === org.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center justify-between flex-1 gap-2">
                    <span className="truncate">{org.name}</span>
                    <OrganizationStatusBadge status={org.kyc_status} />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
