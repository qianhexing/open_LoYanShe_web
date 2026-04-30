import type { BaseResponse, VoteDetail, VoteRecordChoice } from '@/types/api';

export interface VoteIdParams {
  vote_id: number
}

export interface InsertVoteParams {
  [key: string]: unknown
}

export interface InsertVoteRecordParams {
  vote_id: number
  options_id: number[]
}

export async function getVoteDetail(params: VoteIdParams): Promise<VoteDetail> {
  const response = await use$Post<BaseResponse<VoteDetail>>(
    '/vote/detail',
    params
  );
  return response.data;
}

/** 是否已投票；已投时返回已选 options_id 列表，否则为 false / 空 */
export async function getVoteIsVote(
  params: VoteIdParams
): Promise<VoteRecordChoice[] | false | null> {
  const response = await use$Post<
    BaseResponse<VoteRecordChoice[] | false | null>
  >('/vote/isVote', params);
  return response.data;
}

export async function insertVote(data: InsertVoteParams): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>('/vote/insert', data);
  return response.data;
}

export async function insertVoteRecord(
  params: InsertVoteRecordParams
): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>(
    '/vote/record/insert',
    params
  );
  return response.data;
}
