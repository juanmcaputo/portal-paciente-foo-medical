// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS (etapa 1): listado de los ImagingStudy de UN paciente, con el SearchControl de Medplum.
// Recibe patientId por propiedad: no sabe quien entro, asi sirve para el paciente (etapa 1) y el medico (etapa 2).
// Que estudios puede leer lo decide la politica de Medplum.
import { Box, Title } from '@mantine/core';
import { Operator } from '@medplum/core';
import type { SearchRequest } from '@medplum/core';
import { SearchControl } from '@medplum/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router';
import { InfoSection } from '../../components/InfoSection';

interface ImagingStudiesProps {
  readonly patientId: string;
}

export function ImagingStudies({ patientId }: ImagingStudiesProps): JSX.Element {
  const navigate = useNavigate();

  const [options, setOptions] = useState<SearchRequest>({
    resourceType: 'ImagingStudy',
    fields: ['started', 'description', 'modality', 'status'],
    sortRules: [{ code: 'started', descending: true }],
    count: 20,
  });

  // Buscar solo estudios del paciente recibido: el filtro se vuelve a poner en cada render
  const search: SearchRequest = {
    ...options,
    resourceType: 'ImagingStudy',
    filters: [
      {
        code: 'patient',
        operator: Operator.EQUALS,
        value: `Patient/${patientId}`,
      },
    ],
  };

  return (
    <Box p="xl">
      <Title mb="lg">Estudios de imágenes</Title>

      <InfoSection title="Estudios de imagen">
        <SearchControl
          search={search}
          hideToolbar
          hideFilters
          onChange={(e) => {
            setOptions({
              ...e.definition,
              filters: [],
            });
          }}
          onClick={(e) => {
            if (e.resource.resourceType === 'ImagingStudy' && e.resource.id) {
              void navigate(`./${e.resource.id}`);
            }
          }}
        />
      </InfoSection>
    </Box>
  );
}
