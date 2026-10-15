// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS (etapa 2): estructura de navegacion del medico (Practitioner). Igual que la de Historial medico:
// menu lateral (SideMenu) y el contenido de cada ruta en el Outlet.
import { Container, Group } from '@mantine/core';
import { Suspense } from 'react';
import type { JSX } from 'react';
import { Outlet } from 'react-router';
import { Loading } from '../../components/Loading';
import { SideMenu } from '../../components/SideMenu';

const sideMenu = {
  title: 'Médico',
  menu: [{ name: 'Pacientes', href: '/doctor/patients' }],
};

export function DoctorLayout(): JSX.Element {
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
