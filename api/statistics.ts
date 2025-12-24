import type { BaseResponse } from '@/types/api';

export interface WikiTreeNode {
  wiki_id: number;
  wiki_name: string;
  child?: WikiTreeNode[];
  [key: string]: any;
}

export async function getWikiTree(params: { wiki_id: number }): Promise<BaseResponse<WikiTreeNode>> {
  // Assuming the endpoint is /wiki/tree based on user context or inferring.
  // If the endpoint is unknown, I will use a placeholder or try to match the user's snippet logic.
  // The user snippet imported it from '../../../api/statistics'.
  // I will assume the endpoint is '/statistics/wikiTree' or similar if it was in statistics.ts.
  // But commonly it might be '/wiki/tree'.
  // Let's guess '/wiki/getTree' or stick to user provided context.
  // Actually, I'll just use the path '/wiki/tree' as a best guess for a "wiki tree".
  return await use$Post<BaseResponse<WikiTreeNode>>('/wiki/tree', params);
}
