import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    steady_rate: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '2m' },
        { target: 8, duration: '2m' },
        { target: 10, duration: '2m' },
        { target: 12, duration: '2m' },
        { target: 15, duration: '2m' },
        { target: 18, duration: '2m' },
        { target: 20, duration: '2m' },
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const res = http.get(__ENV.BASE_URL, {
    timeout: '15s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}