import type { Asset, AssetStatus, Location, Prisma } from "@prisma/client";
import { z } from "zod";
import type {
  Filter,
  FilterFieldType,
  FilterOperator,
} from "~/components/assets/assets-index/advanced-filters/types";
import { getParamsValues } from "~/utils/list";

export function getLocationUpdateNoteContent({
  currentLocation,
  newLocation,
  firstName,
  lastName,
  assetName,
  isRemoving,
}: {
  currentLocation?: Pick<Location, "id" | "name"> | null;
  newLocation?: Location | null;
  firstName: string;
  lastName: string;
  assetName: string;
  isRemoving?: boolean;
}) {
  let message = "";
  if (currentLocation && newLocation) {
    message = `**${firstName.trim()} ${lastName.trim()}** updated the location of **${assetName.trim()}** from **[${currentLocation.name.trim()}](/locations/${
      currentLocation.id
    })** to **[${newLocation.name.trim()}](/locations/${newLocation.id})**`; // updating location
  }

  if (newLocation && !currentLocation) {
    message = `**${firstName.trim()} ${lastName.trim()}** set the location of **${assetName.trim()}** to **[${newLocation.name.trim()}](/locations/${
      newLocation.id
    })**`; // setting to first location
  }

  if (isRemoving || !newLocation) {
    message = `**${firstName.trim()} ${lastName.trim()}** removed  **${assetName.trim()}** from location **[${currentLocation?.name.trim()}](/locations/${currentLocation?.id})**`; // removing location
  }

  return message;
}

export const CurrentSearchParamsSchema = z.object({
  currentSearchParams: z.string().optional().nullable(),
});

export function getAssetsWhereInput({
  organizationId,
  currentSearchParams,
}: {
  organizationId: Asset["organizationId"];
  currentSearchParams?: string | null;
}) {
  const where: Prisma.AssetWhereInput = { organizationId };

  if (!currentSearchParams) {
    return where;
  }

  const searchParams = new URLSearchParams(currentSearchParams);
  const paramsValues = getParamsValues(searchParams);

  const { categoriesIds, locationIds, tagsIds, search, teamMemberIds } =
    paramsValues;

  const status =
    searchParams.get("status") === "ALL" // If the value is "ALL", we just remove the param
      ? null
      : (searchParams.get("status") as AssetStatus | null);

  if (search) {
    where.title = {
      contains: search.toLowerCase().trim(),
      mode: "insensitive",
    };
  }

  if (status) {
    where.status = status;
  }

  if (categoriesIds && categoriesIds.length > 0) {
    if (categoriesIds.includes("uncategorized")) {
      where.OR = [
        {
          categoryId: {
            in: categoriesIds,
          },
        },
        {
          categoryId: null,
        },
      ];
    } else {
      where.categoryId = {
        in: categoriesIds,
      };
    }
  }

  if (tagsIds && tagsIds.length > 0) {
    if (tagsIds.includes("untagged")) {
      where.OR = [
        ...(where.OR ?? []),
        { tags: { some: { id: { in: tagsIds } } } },
        { tags: { none: {} } },
      ];
    } else {
      where.tags = {
        some: {
          id: {
            in: tagsIds,
          },
        },
      };
    }
  }

  if (locationIds && locationIds.length > 0) {
    if (locationIds.includes("without-location")) {
      where.OR = [
        ...(where.OR ?? []),
        { locationId: { in: locationIds } },
        { locationId: null },
      ];
    } else {
      where.location = {
        id: { in: locationIds },
      };
    }
  }

  if (teamMemberIds && teamMemberIds.length) {
    where.OR = [
      ...(where.OR ?? []),
      {
        custody: { teamMemberId: { in: teamMemberIds } },
      },
      { custody: { custodian: { userId: { in: teamMemberIds } } } },
      {
        bookings: { some: { custodianTeamMemberId: { in: teamMemberIds } } },
      },
      { bookings: { some: { custodianUserId: { in: teamMemberIds } } } },
      ...(teamMemberIds.includes("without-custody") ? [{ custody: null }] : []),
    ];
  }

  return where;
}

// Add this function to parse the filters string
export function parseFilters(filtersString: string): Filter[] {
  const searchParams = new URLSearchParams(filtersString);
  const filters: Filter[] = [];

  searchParams.forEach((value, key) => {
    const [operator, filterValue] = value.split(":");
    const filter: Filter = {
      name: key,
      type: getFilterFieldType(key),
      operator: operator as FilterOperator,
      value: parseFilterValue(key, operator as FilterOperator, filterValue),
    };
    filters.push(filter);
  });

  return filters;
}

// Helper function to determine the FilterFieldType based on the field name
function getFilterFieldType(fieldName: string): FilterFieldType {
  switch (fieldName) {
    case "id":
      return "string";
    case "status":
      return "enum";
    case "description":
      return "text";
    case "valuation":
      return "number";
    case "availableToBook":
      return "boolean";
    case "createdAt":
      return "date";
    default:
      return "string";
  }
}

// Helper function to parse filter values based on their type
function parseFilterValue(
  field: string,
  operator: FilterOperator,
  value: string
): any {
  switch (field) {
    case "valuation":
      return operator === "between"
        ? value.split(",").map(Number)
        : Number(value);
    case "availableToBook":
      return value.toLowerCase() === "true";
    case "createdAt":
      return operator === "between" ? value.split(",") : value;
    case "status":
      return operator === "in"
        ? (value.split(",") as AssetStatus[])
        : (value as AssetStatus);
    default:
      return value;
  }
}
