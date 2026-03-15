import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
  return { chain: params.chain, id: params.id };
};
