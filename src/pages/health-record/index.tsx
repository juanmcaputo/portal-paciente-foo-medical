// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Container, Group } from '@mantine/core';
import { Suspense } from 'react';
import type { JSX } from 'react';
import { Outlet } from 'react-router';
import { Loading } from '../../components/Loading';
import { SideMenu } from '../../components/SideMenu';
// import { measurementsMeta } from './Measurement.data'; // MiniPACS: solo lo usaba Vitals, comentado abajo

const sideMenu = {
  title: 'Historial médico',
  menu: [
    { name: 'Mis estudios', href: '/health-record/imaging-studies' },
    // MiniPACS (etapa 1): en Health Record solo queda Imaging Studies
    // { name: 'Lab Results', href: '/health-record/lab-results' },
    // { name: 'Medications', href: '/health-record/medications' },
    // { name: 'Questionnaire Responses', href: '/health-record/questionnaire-responses' },
    // { name: 'Vaccines', href: '/health-record/vaccines' },
    // {
    //   name: 'Vitals',
    //   href: '/health-record/vitals',
    //   subMenu: Object.values(measurementsMeta).map(({ title, id }) => ({
    //     name: title,
    //     href: `/health-record/vitals/${id}`,
    //   })),
    // },
  ],
};

export function HealthRecord(): JSX.Element {
  return (
    <Container>
      <Group align="top">
        <SideMenu {...sideMenu} />
        <div style={{ width: 800, flex: 800 }}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </Group>
    </Container>
  );
}
