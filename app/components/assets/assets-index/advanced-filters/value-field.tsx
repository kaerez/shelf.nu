import { useCallback, useEffect, useMemo, useState } from "react";
import type { Kit } from "@prisma/client";
import { AssetStatus } from "@prisma/client";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { useLoaderData } from "@remix-run/react";
import { format, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import DynamicDropdown from "~/components/dynamic-dropdown/dynamic-dropdown";
import DynamicSelect from "~/components/dynamic-select/dynamic-select";
import Input from "~/components/forms/input";

import { CheckIcon, ChevronRight, PlusIcon } from "~/components/icons/library";
import { Button } from "~/components/shared/button";
import type { AssetIndexLoaderData } from "~/routes/_layout+/assets._index";
import { useHints } from "~/utils/client-hints";
import { tw } from "~/utils/tw";
import { resolveTeamMemberName } from "~/utils/user";
import type { Filter } from "./schema";
import { userFriendlyAssetStatus } from "../../asset-status-badge";

export function ValueField({
  filter,
  setFilter,
  applyFilters,
}: {
  filter: Filter;
  setFilter: (value: Filter["value"]) => void;
  applyFilters: () => void;
}) {
  const data = useLoaderData<AssetIndexLoaderData>();
  const customFields = useMemo(() => data?.customFields || [], [data]);
  const [localValue, setLocalValue] = useState<[string, string]>(
    Array.isArray(filter.value) ? (filter.value as [string, string]) : ["", ""]
  );
  const [error, setError] = useState<string | null>(null);
  const validateBetweenFilter = useCallback(() => {
    if (filter.operator === "between") {
      const [start, end] = localValue;
      if (start !== "" && end !== "") {
        if (filter.type === "date") {
          const startDate = new Date(start);
          const endDate = new Date(end);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            if (startDate > endDate) {
              setError("Start date must be before or equal to end date");
              return;
            }
          }
        } else if (filter.type === "number") {
          const startNum = parseFloat(start);
          const endNum = parseFloat(end);
          if (!isNaN(startNum) && !isNaN(endNum)) {
            if (startNum > endNum) {
              setError("Start value must be less than or equal to end value");
              return;
            }
          }
        }
      }
    }
    setError(null);
  }, [filter.operator, filter.type, localValue]);

  useEffect(() => {
    validateBetweenFilter();
  }, [localValue, validateBetweenFilter]);

  useEffect(() => {
    if (filter.type === "boolean" && filter.value === "") {
      setFilter(true); // Set default value to true when boolean field is selected
    }

    if (filter.type === "enum" && filter.value === "") {
      const options =
        filter.name === "status"
          ? Object.values(AssetStatus)
          : customFields.find((field) => field?.name === filter.name.slice(3))
              ?.options || [];
      setFilter(options[0]); // Set default value to first option when enum field is selected
    }
  }, [customFields, filter.name, filter.type, filter.value, setFilter]);

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const newValue = event.target.value;
    setFilter(newValue);
  }

  function handleBooleanChange(value: "true" | "false") {
    const newValue = value === "true";
    setFilter(newValue);
  }

  function handleBetweenChange(index: 0 | 1) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [...localValue] as [string, string];
      newValue[index] = event.target.value;
      setLocalValue(newValue);
      if (newValue[0] !== "" && newValue[1] !== "") {
        setFilter(newValue);
      }
    };
  }

  const commonInputProps = {
    inputClassName: "px-4 py-2 text-[14px] leading-5",
    hideLabel: true,
    label: filter.name,
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  };

  /** Generates placeholder for text input fields, based on the operator */
  function placeholder(operator: Filter["operator"]) {
    return ["contains", "containsAll", "containsAny", "matchesAny"].includes(
      operator
    )
      ? "Enter comma-separated values"
      : "Enter value";
  }

  switch (filter.type) {
    case "string":
    case "text":
      return (
        <Input
          {...commonInputProps}
          type="text"
          value={filter.value as string}
          onChange={handleChange}
          placeholder={placeholder(filter.operator)}
          onKeyUp={submitOnEnter}
        />
      );

    case "number":
      if (filter.operator === "between") {
        return (
          <div className="space-y-2">
            <div className="flex max-w-full items-center justify-normal gap-[2px]">
              <Input
                {...commonInputProps}
                label="Start Value"
                type="number"
                value={localValue[0]}
                onChange={handleBetweenChange(0)}
                className="w-1/2"
                min={0}
                onKeyUp={submitOnEnter}
              />
              <Input
                {...commonInputProps}
                label="End Value"
                type="number"
                value={localValue[1]}
                onChange={handleBetweenChange(1)}
                className="w-1/2"
                min={0}
                onKeyUp={submitOnEnter}
              />
            </div>
            {error && (
              <div className="!mt-0 text-[12px] text-red-500">{error}</div>
            )}
          </div>
        );
      } else {
        return (
          <Input
            {...commonInputProps}
            type="number"
            value={filter.value as number}
            onChange={handleChange}
            placeholder="Enter number"
            min={0}
            onKeyUp={submitOnEnter}
          />
        );
      }

    case "boolean":
      return (
        <BooleanField
          value={filter.value as boolean}
          handleBooleanChange={handleBooleanChange}
        />
      );

    case "date":
      return (
        <DateField
          filter={filter}
          setFilter={setFilter}
          applyFilters={applyFilters}
        />
      );

    case "enum":
      return (
        <ValueEnumField
          fieldName={filter.name}
          value={filter.value as string}
          handleChange={setFilter}
          multiSelect={filter.operator === "containsAny"}
        />
      );

    case "array":
      return (
        <Input
          {...commonInputProps}
          type="text"
          label="Values"
          value={
            Array.isArray(filter.value)
              ? filter.value.join(", ")
              : typeof filter.value === "boolean"
              ? "yes" // provide a default value for booleans
              : filter.value
          }
          onChange={(e) => {
            const newValue = e.target.value
              .split(",")
              .map((item) => item.trim());
            setFilter(newValue);
          }}
          placeholder={placeholder(filter.operator)}
          onKeyUp={submitOnEnter}
        />
      );

    default:
      return null;
  }
}

function BooleanField({
  value,
  handleBooleanChange,
}: {
  value: boolean | string;
  handleBooleanChange: (value: "true" | "false") => void;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const boolValue = value === "" ? true : value === "true" || value === true;

  return (
    <>
      <input type="hidden" value={String(boolValue)} />
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            className="w-full justify-start truncate whitespace-nowrap font-normal [&_span]:max-w-full [&_span]:truncate"
          >
            <ChevronRight className="ml-[2px] inline-block rotate-90" />
            <span className="ml-2">{boolValue ? "Yes" : "No"}</span>{" "}
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            align="start"
            className={tw(
              "z-[999999] mt-2 max-h-[400px] min-w-[100px] overflow-scroll rounded-md border border-gray-200 bg-white"
            )}
          >
            <div
              className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:cursor-pointer hover:bg-gray-50"
              onClick={() => {
                handleBooleanChange("true");
                setIsPopoverOpen(false);
              }}
            >
              <span>Yes</span>
            </div>
            <div
              className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:cursor-pointer hover:bg-gray-50"
              onClick={() => {
                handleBooleanChange("false");
                setIsPopoverOpen(false);
              }}
            >
              <span>No</span>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </>
  );
}

interface EnumOption {
  id: string;
  label: string;
}

interface EnumFieldProps {
  value: string;
  options: EnumOption[];
  handleChange: (value: string) => void;
  multiSelect?: boolean;
}

/**
 * Generic enum field component that handles single and multi-select scenarios
 */
function EnumField({
  value,
  options,
  handleChange,
  multiSelect = false,
}: EnumFieldProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Convert the value into an array for multi-select mode
  const selectedValues = multiSelect ? value.split(", ") : [value];

  const displayValue = multiSelect
    ? selectedValues
        .map((v) => options.find((opt) => opt.id === v)?.label ?? v)
        .join(", ")
    : value === ""
    ? options[0]?.label
    : options.find((opt) => opt.id === value)?.label ?? value;

  function handleOptionClick(optionId: string) {
    let newValue: string;
    if (multiSelect) {
      const isSelected = selectedValues.includes(optionId);
      const updatedValues = isSelected
        ? selectedValues.filter((val) => val !== optionId)
        : [...selectedValues, optionId];
      newValue = updatedValues.join(", ");
    } else {
      newValue = optionId;
    }
    handleChange(newValue);
    if (!multiSelect) {
      setIsPopoverOpen(false);
    }
  }

  return (
    <>
      <input type="hidden" value={multiSelect ? displayValue : value} />
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            className="w-full justify-start truncate whitespace-nowrap font-normal [&_span]:max-w-full [&_span]:truncate"
          >
            <ChevronRight className="ml-[2px] inline-block rotate-90" />
            <span className="ml-2">{displayValue}</span>
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            align="start"
            className={tw(
              "z-[999999] mt-2 max-h-[400px] min-w-[250px] overflow-scroll rounded-md border border-gray-200 bg-white"
            )}
          >
            {options.length === 0 ? (
              <div className="max-w-[400px] p-4">
                No options available. Please contact support if you believe this
                is an error.
              </div>
            ) : (
              options.map((option) => {
                const isSelected = selectedValues.includes(option.id);
                return (
                  <div
                    key={option.id}
                    className="flex items-center justify-between px-4 py-3 text-[14px] text-gray-600 hover:cursor-pointer hover:bg-gray-50"
                    onClick={() => handleOptionClick(option.id)}
                  >
                    <span>{option.label}</span>
                    {multiSelect && isSelected && (
                      <span className="h-auto w-[14px] text-primary">
                        <CheckIcon />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </>
  );
}

/**
 * Status-specific enum field that handles asset statuses
 */
function StatusEnumField({
  value,
  handleChange,
  multiSelect,
}: Omit<EnumFieldProps, "options">) {
  const options: EnumOption[] = Object.values(AssetStatus).map((status) => ({
    id: status,
    label: userFriendlyAssetStatus(status),
  }));

  return (
    <EnumField
      value={value}
      options={options}
      handleChange={handleChange}
      multiSelect={multiSelect}
    />
  );
}

/**
 * Custom field-specific enum field that handles custom field options
 */
function CustomFieldEnumField({
  value,
  handleChange,
  fieldName,
  multiSelect,
}: Omit<EnumFieldProps, "options"> & { fieldName: string }) {
  const data = useLoaderData<AssetIndexLoaderData>();
  const customFields = useMemo(
    () => data?.customFields || [],
    [data?.customFields]
  );

  const options: EnumOption[] = useMemo(() => {
    const field = customFields.find((f) => f?.name === fieldName.slice(3));
    return (field?.options || []).map((opt) => ({
      id: opt,
      label: opt,
    }));
  }, [customFields, fieldName]);

  return (
    <EnumField
      value={value}
      options={options}
      handleChange={handleChange}
      multiSelect={multiSelect}
    />
  );
}

/**
 * Custody-specific field component that handles team members and users
 * Uses DynamicSelect for single selection and DynamicDropdown for multi-select
 */
function CustodyEnumField({
  value,
  handleChange,
  multiSelect,
}: Omit<EnumFieldProps, "options">) {
  const data = useLoaderData<AssetIndexLoaderData>();

  // Parse the existing value to get selected TeamMember IDs
  const selectedIds = useMemo(() => {
    if (!value) return [];
    // If it's a containsAny filter, split the values
    if (multiSelect && typeof value === "string") {
      return value.split(",").map((v) => v.trim());
    }
    return [value];
  }, [value, multiSelect]);

  const commonProps = {
    model: {
      name: "teamMember" as const,
      queryKey: "name",
      deletedAt: null,
    },
    transformItem: (item: any) => item,
    renderItem: (item: any) => resolveTeamMemberName(item),
    initialDataKey: "teamMembers",
    countKey: "totalTeamMembers",
    label: "Filter by custodian",
    hideLabel: true,
    hideCounter: true,
    placeholder: "Search team members",
    withoutValueItem: {
      id: "without-custody",
      name: "Without custody",
    },
  };

  if (multiSelect) {
    return (
      <DynamicDropdown
        {...commonProps}
        trigger={
          <Button
            variant="secondary"
            className="w-full justify-start  font-normal [&_span]:w-full [&_span]:max-w-full [&_span]:truncate"
          >
            <div className="flex items-center justify-between">
              <span className=" text-left">
                {value === "without-custody"
                  ? "Without custody"
                  : selectedIds.length > 0
                  ? selectedIds
                      .map((id) => {
                        const teamMember = data.teamMembers.find(
                          (tm) => tm.id === id
                        );
                        return resolveTeamMemberName({
                          name: teamMember?.name || "",
                        });
                      })
                      .join(", ")
                  : "Select custodian"}
              </span>
              <ChevronRight className="mr-1 inline-block rotate-90" />
            </div>
          </Button>
        }
        triggerWrapperClassName="w-full"
        className="z-[999999]"
        selectionMode="none"
        defaultValues={selectedIds}
        onSelectionChange={(selectedTeamMemberIds) => {
          handleChange(selectedTeamMemberIds.join(","));
        }}
      />
    );
  }

  return (
    <DynamicSelect
      {...commonProps}
      placeholder="Select custodian"
      defaultValue={value as string}
      onChange={(selectedId) => {
        handleChange(selectedId);
      }}
      closeOnSelect={true}
      triggerWrapperClassName="w-full text-gray-700"
      className="z-[999999]"
      contentLabel="Custodian"
    />
  );
}

/** Component that handles category selection for both single and multi-select scenarios */
function CategoryEnumField({
  value,
  handleChange,
  multiSelect,
}: Omit<EnumFieldProps, "options">) {
  const data = useLoaderData<AssetIndexLoaderData>();

  // Parse the existing value to get selected Category IDs
  const selectedIds = useMemo(() => {
    if (!value) return [];
    // Handle multi-select values
    if (multiSelect && typeof value === "string") {
      return value.split(",").map((v) => v.trim());
    }
    return [value];
  }, [value, multiSelect]);

  /** Common props for both DynamicSelect and DynamicDropdown */
  const commonProps = {
    model: {
      name: "category" as const,
      queryKey: "name",
    },
    transformItem: (item: any) => ({
      ...item,
      id: item.id === "uncategorized" ? "uncategorized" : item.id,
    }),
    renderItem: (item: any) => (
      <div className="flex items-center gap-2">
        <div
          className="size-3 rounded-full"
          style={{ backgroundColor: item.metadata?.color || "#808080" }}
        />
        <span>{item.name}</span>
      </div>
    ),
    initialDataKey: "categories",
    countKey: "totalCategories",
    label: "Filter by category",
    hideLabel: true,
    hideCounter: true,
    placeholder: "Search categories",
    withoutValueItem: {
      id: "uncategorized",
      name: "Uncategorized",
    },
  };

  // For multi-select (containsAny operator), use DynamicDropdown
  if (multiSelect) {
    return (
      <DynamicDropdown
        {...commonProps}
        trigger={
          <Button
            variant="secondary"
            className="w-full justify-start font-normal [&_span]:w-full [&_span]:max-w-full [&_span]:truncate"
          >
            <div className="flex items-center justify-between">
              <span className="text-left">
                {selectedIds.length > 0
                  ? selectedIds
                      .map((id) => {
                        const category = data.categories?.find(
                          (cat) => cat.id === id
                        );
                        return id === "uncategorized"
                          ? "Uncategorized"
                          : category?.name || "";
                      })
                      .join(", ")
                  : "Select category"}
              </span>
              <ChevronRight className="mr-1 inline-block rotate-90" />
            </div>
          </Button>
        }
        triggerWrapperClassName="w-full"
        className="z-[999999]"
        selectionMode="none"
        defaultValues={selectedIds}
        onSelectionChange={(selectedCategoryIds) => {
          handleChange(selectedCategoryIds.join(","));
        }}
      />
    );
  }

  // For single select (is/isNot operators), use DynamicSelect
  return (
    <DynamicSelect
      {...commonProps}
      placeholder="Select category"
      defaultValue={value as string}
      onChange={(selectedId) => {
        handleChange(selectedId);
      }}
      closeOnSelect={true}
      triggerWrapperClassName="w-full text-gray-700"
      className="z-[999999]"
      contentLabel="Category"
    />
  );
}

/** Component that handles location selection for both single and multi-select scenarios */
function LocationEnumField({
  value,
  handleChange,
  multiSelect,
}: Omit<EnumFieldProps, "options">) {
  const data = useLoaderData<AssetIndexLoaderData>();

  // Parse the existing value to get selected Category IDs
  const selectedIds = useMemo(() => {
    if (!value) return [];
    // Handle multi-select values
    if (multiSelect && typeof value === "string") {
      return value.split(",").map((v) => v.trim());
    }
    return [value];
  }, [value, multiSelect]);

  /** Common props for both DynamicSelect and DynamicDropdown */
  const commonProps = {
    model: {
      name: "location" as const,
      queryKey: "name",
    },
    transformItem: (item: any) => ({
      ...item,
      id: item.id === "without-location" ? "without-location" : item.id,
    }),
    renderItem: (item: any) => (item.name ? item.name : "Without location"),
    initialDataKey: "locations",
    countKey: "totalLocations",
    label: "Filter by location",
    hideLabel: true,
    hideCounter: true,
    placeholder: "Search locations",
    withoutValueItem: {
      id: "without-location",
      name: "Without location",
    },
  };

  // For multi-select (containsAny operator), use DynamicDropdown
  if (multiSelect) {
    return (
      <DynamicDropdown
        {...commonProps}
        trigger={
          <Button
            variant="secondary"
            className="w-full justify-start font-normal [&_span]:w-full [&_span]:max-w-full [&_span]:truncate"
          >
            <div className="flex items-center justify-between">
              <span className="text-left">
                {selectedIds.length > 0
                  ? selectedIds
                      .map((id) => {
                        const location = data.locations?.find(
                          (loc) => loc.id === id
                        );
                        return id === "without-location"
                          ? "Without location"
                          : location?.name || "";
                      })
                      .join(", ")
                  : "Select location"}
              </span>
              <ChevronRight className="mr-1 inline-block rotate-90" />
            </div>
          </Button>
        }
        triggerWrapperClassName="w-full"
        className="z-[999999]"
        selectionMode="none"
        defaultValues={selectedIds}
        onSelectionChange={(selectedLocationsIds) => {
          handleChange(selectedLocationsIds.join(","));
        }}
      />
    );
  }

  // For single select (is/isNot operators), use DynamicSelect
  return (
    <DynamicSelect
      {...commonProps}
      placeholder="Select location"
      defaultValue={value as string}
      onChange={(selectedId) => {
        handleChange(selectedId);
      }}
      closeOnSelect={true}
      triggerWrapperClassName="w-full text-gray-700"
      className="z-[999999]"
      contentLabel="Location"
    />
  );
}

/** Component that handles location selection for both single and multi-select scenarios */
function KitEnumField({
  value,
  handleChange,
  multiSelect,
}: Omit<EnumFieldProps, "options">) {
  // @TODO - this hardcoded type should be fixed to be inferred from the API response
  const data = useLoaderData<{ kits: Kit[]; totalKits: number }>();

  // Parse the existing value to get selected Category IDs
  const selectedIds = useMemo(() => {
    if (!value) return [];
    // Handle multi-select values
    if (multiSelect && typeof value === "string") {
      return value.split(",").map((v) => v.trim());
    }
    return [value];
  }, [value, multiSelect]);

  /** Common props for both DynamicSelect and DynamicDropdown */
  const commonProps = {
    model: {
      name: "kit" as const,
      queryKey: "name",
    },
    transformItem: (item: any) => ({
      ...item,
      id: item.id === "without-kit" ? "without-kit" : item.id,
    }),
    renderItem: (item: any) => (item.name ? item.name : "Without kit"),
    initialDataKey: "kits",
    countKey: "totalKits",
    label: "Filter by kit",
    hideLabel: true,
    hideCounter: true,
    placeholder: "Search kits",
    withoutValueItem: {
      id: "without-kit",
      name: "Without kit",
    },
  };

  // For multi-select (containsAny operator), use DynamicDropdown
  if (multiSelect) {
    return (
      <DynamicDropdown
        {...commonProps}
        trigger={
          <Button
            variant="secondary"
            className="w-full justify-start font-normal [&_span]:w-full [&_span]:max-w-full [&_span]:truncate"
          >
            <div className="flex items-center justify-between">
              <span className="text-left">
                {selectedIds.length > 0
                  ? selectedIds
                      .map((id) => {
                        const kit = data.kits?.find((kit) => kit.id === id);
                        return id === "without-kit"
                          ? "Without kit"
                          : kit?.name || "";
                      })
                      .join(", ")
                  : "Select location"}
              </span>
              <ChevronRight className="mr-1 inline-block rotate-90" />
            </div>
          </Button>
        }
        triggerWrapperClassName="w-full"
        className="z-[999999]"
        selectionMode="none"
        defaultValues={selectedIds}
        onSelectionChange={(selectedKitsIds) => {
          handleChange(selectedKitsIds.join(","));
        }}
      />
    );
  }

  // For single select (is/isNot operators), use DynamicSelect
  return (
    <DynamicSelect
      {...commonProps}
      placeholder="Select kit"
      defaultValue={value as string}
      onChange={(selectedId) => {
        handleChange(selectedId);
      }}
      closeOnSelect={true}
      triggerWrapperClassName="w-full text-gray-700"
      className="z-[999999]"
      contentLabel="Kit"
    />
  );
}

/**
 * Component that determines which enum field to render based on field name
 */
function ValueEnumField({
  fieldName,
  value,
  handleChange,
  multiSelect,
}: {
  fieldName: string;
  value: string;
  handleChange: (value: string) => void;
  multiSelect?: boolean;
}) {
  if (fieldName === "status") {
    return (
      <StatusEnumField
        value={value}
        handleChange={handleChange}
        multiSelect={multiSelect}
      />
    );
  }

  if (fieldName === "category") {
    return (
      <CategoryEnumField
        value={value}
        handleChange={handleChange}
        multiSelect={multiSelect}
      />
    );
  }

  if (fieldName === "location") {
    return (
      <LocationEnumField
        value={value}
        handleChange={handleChange}
        multiSelect={multiSelect}
      />
    );
  }

  if (fieldName === "custody") {
    return (
      <CustodyEnumField
        value={value}
        handleChange={handleChange}
        multiSelect={multiSelect}
      />
    );
  }

  if (fieldName === "kit") {
    return (
      <KitEnumField
        value={value}
        handleChange={handleChange}
        multiSelect={multiSelect}
      />
    );
  }

  if (fieldName.startsWith("cf_")) {
    return (
      <CustomFieldEnumField
        value={value}
        handleChange={handleChange}
        fieldName={fieldName}
        multiSelect={multiSelect}
      />
    );
  }

  return null;
}
// Define the props for the DateField component
type DateFieldProps = {
  filter: Filter;
  setFilter: (value: Filter["value"]) => void;
  applyFilters: () => void;
};

// @TODO - move to a proper location
function isDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const date = parseISO(value);
  return !isNaN(date.getTime());
}

function adjustDateToUTC(dateString: string, timeZone: string): string {
  const zonedDate = toZonedTime(parseISO(dateString), timeZone);
  const utcDate = fromZonedTime(zonedDate, timeZone);
  return format(utcDate, "yyyy-MM-dd");
}

/**
 * DateField component for handling date-based filters
 * Supports both single date and date range selections
 */
export function DateField({ filter, setFilter, applyFilters }: DateFieldProps) {
  const { timeZone } = useHints();
  const [localValue, setLocalValue] = useState<[string, string]>(["", ""]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function adjustDateToUserTimezone(dateString: string): string {
      // If the date string is empty or not a valid date format, return empty string
      if (!dateString || !isDateString(dateString)) {
        return "";
      }

      try {
        const date = toZonedTime(parseISO(dateString), timeZone);
        return format(date, "yyyy-MM-dd");
      } catch {
        return "";
      }
    }

    if (Array.isArray(filter.value)) {
      const start = isDateString(filter.value[0])
        ? filter.value[0]
        : String(filter.value[0]);
      const end = isDateString(filter.value[1])
        ? filter.value[1]
        : String(filter.value[1]);
      setLocalValue([
        adjustDateToUserTimezone(start),
        adjustDateToUserTimezone(end),
      ]);
    } else {
      const value = isDateString(filter.value)
        ? filter.value
        : String(filter.value);
      setLocalValue([adjustDateToUserTimezone(value), ""]);
    }
  }, [filter.value, timeZone]);

  function handleDateChange(index: 0 | 1) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [...localValue] as [string, string];
      newValue[index] = event.target.value;
      setLocalValue(newValue);

      if (filter.operator === "between" && newValue[0] && newValue[1]) {
        setFilter([
          adjustDateToUTC(newValue[0], timeZone),
          adjustDateToUTC(newValue[1], timeZone),
        ]);
      } else if (filter.operator !== "between" && newValue[0]) {
        setFilter(adjustDateToUTC(newValue[0], timeZone));
      }
      validateDates(newValue);
    };
  }

  function validateDates([start, end]: [string, string]) {
    if (start && end) {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      if (startDate > endDate) {
        setError("Start date must be before or equal to end date");
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !error) {
      applyFilters();
    }
  };

  const commonInputProps = {
    inputClassName: "px-4 py-2 text-[14px] leading-5",
    hideLabel: true,
    label: filter.name,
    onKeyUp: submitOnEnter,
  };

  if (filter.operator === "between") {
    return (
      <div className="space-y-2">
        <div className="flex max-w-full items-center justify-normal gap-[2px]">
          <Input
            {...commonInputProps}
            label="Start Date"
            type="date"
            value={localValue[0]}
            onChange={handleDateChange(0)}
            className="w-1/2"
          />
          <Input
            {...commonInputProps}
            label="End Date"
            type="date"
            value={localValue[1]}
            onChange={handleDateChange(1)}
            className="w-1/2"
          />
        </div>
        {error && localValue[0] !== "" && localValue[1] !== "" && (
          <div className="!mt-0 text-[12px] text-red-500">{error}</div>
        )}
      </div>
    );
  } else if (filter.operator === "inDates") {
    return (
      <MultiDateInput
        setValue={(value) => setFilter(value)}
        value={typeof filter.value === "string" ? filter.value : ""}
        timeZone={timeZone}
        commonInputProps={commonInputProps}
      />
    );
  } else {
    return (
      <Input
        {...commonInputProps}
        type="date"
        value={localValue[0]}
        onChange={handleDateChange(0)}
      />
    );
  }
}

function MultiDateInput({
  setValue,
  value,
  timeZone,
  commonInputProps,
}: {
  setValue: (value: string) => void;
  value: string;
  timeZone: string;
  commonInputProps: {
    inputClassName: string;
    hideLabel: boolean;
    label: string;
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  };
}) {
  // Parse initial dates from comma-separated string
  const [dates, setDates] = useState<string[]>(() => {
    if (!value) return [""];
    return value.split(",").map((d) => d.trim());
  });

  // Handle date change at specific index
  const handleDateChange =
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const newDates = [...dates];
      newDates[index] = event.target.value;
      setDates(newDates);

      // Filter out empty dates and convert to UTC
      const validDates = newDates
        .filter((date) => date)
        .map((date) => adjustDateToUTC(date, timeZone));

      // Update parent with comma-separated string
      setValue(validDates.join(","));
    };

  // Add new date field
  const addDateField = () => {
    setDates([...dates, ""]);
  };
  // Remove date field at index
  const removeDateField = (indexToRemove: number) => {
    const newDates = dates.filter((_, index) => index !== indexToRemove);
    setDates(newDates);

    // Update parent with remaining dates
    const validDates = newDates
      .filter((date) => date)
      .map((date) => adjustDateToUTC(date, timeZone));
    setValue(validDates.join(","));
  };

  return (
    <div className="space-y-1">
      {dates.map((date, index) => (
        <div key={index} className="relative flex items-center gap-2">
          <Input
            {...commonInputProps}
            type="date"
            value={date}
            onChange={handleDateChange(index)}
            className="flex-1"
          />
          {dates.length > 1 && (
            <Button
              variant="block-link-gray"
              className="absolute right-0 -mr-1 mt-[2px] shrink-0 translate-x-full  bg-white  text-[10px] font-normal text-gray-600"
              icon="x"
              onClick={() => removeDateField(index)}
            />
          )}
        </div>
      ))}
      <Button
        variant="block-link"
        className="text-[14px]"
        size="xs"
        onClick={addDateField}
      >
        <div className="mr-1 inline-block size-[14px] align-middle">
          <PlusIcon />
        </div>
        <span className="inline-block align-middle">Add another date</span>
      </Button>
    </div>
  );
}