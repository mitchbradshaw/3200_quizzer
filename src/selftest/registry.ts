// Every self-test in the app. Topic folders own their own lists, so they can be edited in parallel.
import type { SelfTest } from './types';
import { coreTests } from './core';
import { tests as discrete } from './physics_discrete';
import { tests as continuous } from './physics_continuous';
import { tests as content } from './content';
import { tests as A1 } from '../topics/A1/selftests';
import { tests as A2 } from '../topics/A2/selftests';
import { tests as A3 } from '../topics/A3/selftests';
import { tests as A4 } from '../topics/A4/selftests';
import { tests as A5 } from '../topics/A5/selftests';
import { tests as A6 } from '../topics/A6/selftests';
import { tests as B1 } from '../topics/B1/selftests';
import { tests as B2 } from '../topics/B2/selftests';
import { tests as B3 } from '../topics/B3/selftests';
import { tests as B4 } from '../topics/B4/selftests';
import { tests as B5 } from '../topics/B5/selftests';
import { tests as B6 } from '../topics/B6/selftests';
import { tests as C1 } from '../topics/C1/selftests';
import { tests as C2 } from '../topics/C2/selftests';
import { tests as C3 } from '../topics/C3/selftests';
import { tests as C4 } from '../topics/C4/selftests';

export const ALL_TESTS: SelfTest[] = [
  ...coreTests,
  ...discrete,
  ...continuous,
  ...content,
  ...A1, ...A2, ...A3, ...A4, ...A5, ...A6,
  ...B1, ...B2, ...B3, ...B4, ...B5, ...B6,
  ...C1, ...C2, ...C3, ...C4,
];
