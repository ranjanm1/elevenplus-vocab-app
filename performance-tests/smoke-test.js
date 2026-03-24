import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL;
  const res = http.get(baseUrl);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}