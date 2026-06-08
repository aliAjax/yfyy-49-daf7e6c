import type { ServiceItemMaterial, ServiceItem, Case } from '../types';

export function parseMaterialList(
  materialList?: ServiceItemMaterial[] | null,
  legacyMaterials?: string | null,
  serviceItemId?: string
): ServiceItemMaterial[] {
  if (materialList && materialList.length > 0) {
    return materialList;
  }

  if (legacyMaterials) {
    try {
      const parsed = JSON.parse(legacyMaterials);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((m: any, index: number) => ({
          id: `legacy-${index}`,
          service_item_id: serviceItemId || '',
          name: m.name || '',
          is_required: m.required ? 1 : 0,
          description: m.description || '',
          example: '',
          sort_order: index,
          created_at: '',
          updated_at: '',
        }));
      }
    } catch {
      // 解析失败，返回空数组
    }
  }

  return [];
}

export function hasMaterials(
  materialList?: ServiceItemMaterial[] | null,
  legacyMaterials?: string | null
): boolean {
  if (materialList && materialList.length > 0) {
    return true;
  }
  if (legacyMaterials) {
    try {
      const parsed = JSON.parse(legacyMaterials);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

export function getServiceItemMaterialList(serviceItem: ServiceItem): ServiceItemMaterial[] {
  return parseMaterialList(
    serviceItem.material_list,
    serviceItem.materials,
    serviceItem.id
  );
}

export function hasServiceItemMaterials(serviceItem: ServiceItem): boolean {
  return hasMaterials(serviceItem.material_list, serviceItem.materials);
}

export function getCaseMaterialList(caseItem: Case): ServiceItemMaterial[] {
  return parseMaterialList(
    caseItem.material_list,
    caseItem.required_materials,
    caseItem.service_item_id
  );
}

export function hasCaseMaterials(caseItem: Case): boolean {
  return hasMaterials(caseItem.material_list, caseItem.required_materials);
}
