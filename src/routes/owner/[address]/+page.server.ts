import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
  return { address: params.address };
};
