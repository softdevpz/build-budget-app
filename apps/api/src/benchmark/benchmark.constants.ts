// Below this many data points, an "average" is really just one or two
// people's actual spend — publishing it would de-anonymize them.
export const MIN_SAMPLE_SIZE = 3;

export const CACHE_KEY = 'benchmark:stats';
export const CACHE_TTL_SECONDS = 60 * 60;
