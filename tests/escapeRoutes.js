// Hand-authored solutions, kept outside product code and hints.
export const escapeRoutes = {
  push:'r c r c r r r c r c r r r r',
  cover:'r c r r c r r r r r',
  rope:'r u u u r r r r r r r r',
  build:'r p r p r r r p r p r p r r r',
  pit:'l l c r r c r r r',
  plate:'r c r c r r r r r r r',
  jets:'r u u u u r r r r r r r',
  ration:'r p r p r t k t r r p r p r t k t p r r r',
};
for(const key of Object.keys(escapeRoutes))escapeRoutes[key]=escapeRoutes[key].split(' ');
