import { Prisma } from "@prisma/client";
import type { AssetStatus, CustomFieldType } from "@prisma/client";
import type { Filter } from "~/components/assets/assets-index/advanced-filters/types";
import type { CustomFieldSorting } from "./types";

/**
 * Generates the WHERE clause for the asset query based on the provided filters
 * @param organizationId - The ID of the organization
 * @param search - The search string (if any)
 * @param filters - An array of Filter objects
 * @returns Prisma.Sql object representing the WHERE clause
 */
export function generateWhereClause(
  organizationId: string,
  search: string | null,
  filters: Filter[]
): Prisma.Sql {
  let whereClause = Prisma.sql`WHERE a."organizationId" = ${organizationId}`;

  // Add search condition if search string is provided
  if (search) {
    const words = search.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const searchQuery = words
        .map((word) => `${word}:* | ${word}`)
        .join(" | ");
      whereClause = Prisma.sql`
        ${whereClause} AND (
          to_tsvector('english', a."title" || ' ' || COALESCE(a."description", '')) @@ to_tsquery('english', ${searchQuery})
        )
      `;
    }
  }

  // Process each filter
  filters.forEach((filter) => {
    const { name, type, operator, value } = filter;

    switch (type) {
      case "string":
        whereClause = addStringFilter(whereClause, name, operator, value);
        break;
      case "enum":
        whereClause = addEnumFilter(whereClause, name, operator, value);
        break;
      case "text":
        whereClause = addTextFilter(whereClause, name, operator, value);
        break;
      case "number":
        whereClause = addNumberFilter(whereClause, name, operator, value);
        break;
      case "boolean":
        whereClause = addBooleanFilter(whereClause, name, value);
        break;
      case "date":
        whereClause = addDateFilter(whereClause, name, operator, value);
        break;
    }
  });

  // Return the WHERE clause without the GROUP BY
  return whereClause;
}

/**
 * Adds a string filter to the WHERE clause
 */
function addStringFilter(
  whereClause: Prisma.Sql,
  field: string,
  operator: string,
  value: string
): Prisma.Sql {
  switch (operator) {
    case "is":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" = ${value}`;
    case "isNot":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(
        field
      )}" != ${value}`;
    default:
      return whereClause;
  }
}

/**
 * Adds an enum filter to the WHERE clause
 */
function addEnumFilter(
  whereClause: Prisma.Sql,
  field: string,
  operator: string,
  value: AssetStatus | AssetStatus[]
): Prisma.Sql {
  switch (operator) {
    case "is":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" = ${value}`;
    case "isNot":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(
        field
      )}" != ${value}`;
    case "in":
      if (Array.isArray(value)) {
        return Prisma.sql`${whereClause} AND a."${Prisma.raw(
          field
        )}" IN (${Prisma.join(value)})`;
      }
      return whereClause;
    default:
      return whereClause;
  }
}

/**
 * Adds a text filter to the WHERE clause
 */
function addTextFilter(
  whereClause: Prisma.Sql,
  field: string,
  operator: string,
  value: string
): Prisma.Sql {
  switch (operator) {
    case "contains":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(
        field
      )}" ILIKE ${`%${value}%`}`;
    default:
      return whereClause;
  }
}

/**
 * Adds a number filter to the WHERE clause
 */
function addNumberFilter(
  whereClause: Prisma.Sql,
  field: string,
  operator: string,
  value: number | number[]
): Prisma.Sql {
  switch (operator) {
    case "is":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" = ${value}`;
    case "isNot":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(
        field
      )}" != ${value}`;
    case "gt":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" > ${value}`;
    case "lt":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" < ${value}`;
    case "gte":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(
        field
      )}" >= ${value}`;
    case "lte":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(
        field
      )}" <= ${value}`;
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" BETWEEN ${
          value[0]
        } AND ${value[1]}`;
      }
      return whereClause;
    default:
      return whereClause;
  }
}

/**
 * Adds a boolean filter to the WHERE clause
 */
function addBooleanFilter(
  whereClause: Prisma.Sql,
  field: string,
  value: boolean
): Prisma.Sql {
  return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" = ${value}`;
}

/**
 * Adds a date filter to the WHERE clause
 */
function addDateFilter(
  whereClause: Prisma.Sql,
  field: string,
  operator: string,
  value: string | string[]
): Prisma.Sql {
  switch (operator) {
    case "is":
      return Prisma.sql`${whereClause} AND DATE(a."${Prisma.raw(
        field
      )}") = ${value}`;
    case "isNot":
      return Prisma.sql`${whereClause} AND DATE(a."${Prisma.raw(
        field
      )}") != ${value}`;
    case "before":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" < ${value}`;
    case "after":
      return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" > ${value}`;
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        return Prisma.sql`${whereClause} AND a."${Prisma.raw(field)}" BETWEEN ${
          value[0]
        } AND ${value[1]}`;
      }
      return whereClause;
    default:
      return whereClause;
  }
}

// 2. Sorting
type DirectAssetField =
  | "id"
  | "name"
  | "valuation"
  | "status"
  | "description"
  | "createdAt"
  | "availableToBook";

const directAssetFields: Record<DirectAssetField, string> = {
  id: "assetId",
  name: "assetTitle",
  valuation: "assetValue",
  status: "assetStatus",
  description: "assetDescription",
  createdAt: "assetCreatedAt",
  availableToBook: "assetAvailableToBook",
};

export function parseSortingOptions(sortBy: string[]): {
  orderByClause: string;
  customFieldSortings: CustomFieldSorting[];
} {
  const fields = sortBy.map((s) => {
    const [name, direction, fieldType] = s.split(":");
    return { name, direction, fieldType } as {
      name: string;
      direction: "asc" | "desc";
      fieldType: CustomFieldType;
    };
  });

  const orderByParts: string[] = [];
  const customFieldSortings: CustomFieldSorting[] = [];

  for (const field of fields) {
    if (field.name in directAssetFields) {
      const columnName = directAssetFields[field.name as DirectAssetField];
      orderByParts.push(`"${columnName}" ${field.direction}`);
    } else if (field.name === "kit") {
      orderByParts.push(`"kitName" ${field.direction}`);
    } else if (field.name === "category") {
      orderByParts.push(`"categoryName" ${field.direction}`);
    } else if (field.name === "location") {
      orderByParts.push(`"locationName" ${field.direction}`);
    } else if (field.name === "custody") {
      orderByParts.push(`custody->>'name' ${field.direction}`);
    } else if (field.name.startsWith("cf_")) {
      const customFieldName = field.name.slice(3); // Remove 'cf_' prefix
      const alias = `cf_${customFieldName.replace(/\s+/g, "_")}`;
      customFieldSortings.push({
        name: customFieldName,
        valueKey: "raw",
        alias,
        fieldType: field.fieldType,
      });
      orderByParts.push(`${alias} ${field.direction}`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`Unknown sort field: ${field.name}`);
    }
  }

  const orderByClause =
    orderByParts.length > 0 ? `ORDER BY ${orderByParts.join(", ")}` : "";

  return { orderByClause, customFieldSortings };
}

export function generateCustomFieldSelect(
  customFieldSortings: CustomFieldSorting[]
): Prisma.Sql {
  if (customFieldSortings.length === 0) return Prisma.empty;

  return Prisma.sql`, ${Prisma.join(
    customFieldSortings.map(
      (cf) =>
        Prisma.sql`(
      SELECT 
        CASE ${cf.fieldType}
          WHEN 'DATE' THEN 
            (acfv.value->>'valueDate')::timestamp::text
          WHEN 'NUMBER' THEN 
            (acfv.value->>'raw')::numeric::text
          WHEN 'BOOLEAN' THEN 
            (acfv.value->>'valueBoolean')::boolean::text
          ELSE
            acfv.value->>'raw'
        END
      FROM public."AssetCustomFieldValue" acfv
      JOIN public."CustomField" cf ON acfv."customFieldId" = cf.id
      WHERE acfv."assetId" = a.id AND cf.name = ${cf.name}
    ) AS ${Prisma.raw(cf.alias)}`
    )
  )}`;
}

// 3. Data
export const assetQueryFragment = Prisma.sql`
  SELECT 
    a.id AS "assetId",
    a.title AS "assetTitle",
    a.description AS "assetDescription",
    a."createdAt" AS "assetCreatedAt",
    a."updatedAt" AS "assetUpdatedAt",
    a."userId" AS "assetUserId",
    a."mainImage" AS "assetMainImage",
    a."mainImageExpiration" AS "assetMainImageExpiration",
    a."locationId" AS "assetLocationId",
    a."organizationId" AS "assetOrganizationId",
    a.status AS "assetStatus",
    a.value AS "assetValue",
    a."availableToBook" AS "assetAvailableToBook",
    a."kitId" AS "assetKitId",
    a."categoryId" AS "assetCategoryId",
    k.id AS "kitId",
    k.name AS "kitName",
    c.id AS "categoryId",
    c.name AS "categoryName",
    c.color AS "categoryColor",
    l.name AS "locationName",
    json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) AS tags,
    COALESCE(
      CASE 
        WHEN cu.id IS NOT NULL THEN
          jsonb_build_object(
            'name', tm.name,
            'custodian', jsonb_build_object(
              'name', tm.name,
              'user', CASE 
                WHEN u.id IS NOT NULL THEN
                  jsonb_build_object(
                    'firstName', u."firstName",
                    'lastName', u."lastName",
                    'profilePicture', u."profilePicture",
                    'email', u.email
                  )
                ELSE NULL
              END
            )
          )
        WHEN b.id IS NOT NULL THEN
          jsonb_build_object(
            'name', COALESCE(CONCAT(bu."firstName", ' ', bu."lastName"), btm.name),
            'custodian', jsonb_build_object(
              'name', COALESCE(CONCAT(bu."firstName", ' ', bu."lastName"), btm.name),
              'user', CASE 
                WHEN bu.id IS NOT NULL THEN
                  jsonb_build_object(
                    'firstName', bu."firstName",
                    'lastName', bu."lastName",
                    'profilePicture', bu."profilePicture",
                    'email', bu.email
                  )
                ELSE NULL
              END
            )
          )
        ELSE NULL
      END,
      NULL
    ) AS custody,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', acfv.id,
          'value', acfv.value,
          'customField', jsonb_build_object(
            'id', cf.id,
            'name', cf.name,
            'helpText', cf."helpText",
            'required', cf.required,
            'type', cf.type,
            'options', cf.options,
            'categories', (
              SELECT jsonb_agg(jsonb_build_object('id', cat.id, 'name', cat.name))
              FROM public."_CategoryToCustomField" ccf
              JOIN public."Category" cat ON ccf."A" = cat.id
              WHERE ccf."B" = cf.id
            )
          )
        )
      )
      FROM public."AssetCustomFieldValue" acfv
      JOIN public."CustomField" cf ON acfv."customFieldId" = cf.id
      WHERE acfv."assetId" = a.id AND cf.active = true
    ) AS "customFields"
`;

export const assetQueryJoins = Prisma.sql`
  FROM public."Asset" a
  LEFT JOIN public."Kit" k ON a."kitId" = k.id
  LEFT JOIN public."Category" c ON a."categoryId" = c.id
  LEFT JOIN public."Location" l ON a."locationId" = l.id
  LEFT JOIN public."_AssetToTag" att ON a.id = att."A"
  LEFT JOIN public."Tag" t ON att."B" = t.id
  LEFT JOIN public."Custody" cu ON cu."assetId" = a.id
  LEFT JOIN public."TeamMember" tm ON cu."teamMemberId" = tm.id
  LEFT JOIN public."User" u ON tm."userId" = u.id
  LEFT JOIN LATERAL (
    SELECT b.*
    FROM public."Booking" b
    JOIN public."_AssetToBooking" atb ON b.id = atb."B" AND a.id = atb."A"
    WHERE b.status IN ('ONGOING', 'OVERDUE')
    LIMIT 1
  ) b ON TRUE
  LEFT JOIN public."User" bu ON b."custodianUserId" = bu.id
  LEFT JOIN public."TeamMember" btm ON b."custodianTeamMemberId" = btm.id
`;

// 4. Return
export const assetReturnFragment = Prisma.sql`
  json_agg(
    jsonb_build_object(
      'id', aq."assetId",
      'title', aq."assetTitle",
      'description', aq."assetDescription",
      'createdAt', aq."assetCreatedAt",
      'updatedAt', aq."assetUpdatedAt",
      'userId', aq."assetUserId",
      'mainImage', aq."assetMainImage",
      'mainImageExpiration', aq."assetMainImageExpiration",
      'categoryId', aq."assetCategoryId",
      'locationId', aq."assetLocationId",
      'organizationId', aq."assetOrganizationId",
      'status', aq."assetStatus",
      'valuation', aq."assetValue",
      'availableToBook', aq."assetAvailableToBook",
      'kitId', aq."assetKitId",
      'kit', CASE WHEN aq."kitId" IS NOT NULL THEN jsonb_build_object('id', aq."kitId", 'name', aq."kitName") ELSE NULL END,
      'category', CASE WHEN aq."categoryId" IS NOT NULL THEN jsonb_build_object('id', aq."categoryId", 'name', aq."categoryName", 'color', aq."categoryColor") ELSE NULL END,
      'tags', aq.tags,
      'location', jsonb_build_object('name', aq."locationName"),
      'custody', aq.custody,
      'customFields', COALESCE(aq."customFields", '[]'::jsonb)
    )
  ) AS assets
`;
