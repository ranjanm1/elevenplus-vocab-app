import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    steady_rate: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { target: 5, duration: '2m' },
        { target: 10, duration: '2m' },
        { target: 20, duration: '2m' },
        { target: 40, duration: '2m' },
        { target: 60, duration: '2m' },
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const res = http.get(__ENV.BASE_URL);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}