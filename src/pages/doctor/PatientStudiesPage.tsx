// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS (etapa 2): los estudios del paciente elegido por el medico. Toma el patientId de la URL
// (/doctor/patients/:patientId/imaging-studies[/:studyId]) y se lo pasa a los MISMOS componentes que usa el paciente:
// ImagingStudies (listado) e ImagingStudyDetail (detalle). Arriba avisa que es la vista del medico, de que paciente
// son los estudios, y tiene el boton para volver al listado de pacientes.
import { Alert, Box, Button, Group, Text } from '@mantine/core';
import { formatHumanName } from '@medplum/core';
import type { Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconArrowLeft, IconStethoscope } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ImagingStudies } from '../health-record/ImagingStudies';
import { ImagingStudyDetail } from '../health-record/ImagingStudyDetail';

/** System del DNI: el mismo que usa el sincronizador (paciente.identificador-system). */
const SISTEMA_DNI = 'http://www.renaper.gob.ar/dni';

export function PatientStudiesPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { patientId = '', studyId } = useParams();

  // El paciente elegido, para mostrar su nombre y DNI (lo que puede leer el medico lo decide Medplum)
  const paciente: Patient = medplum.readResource('Patient', patientId).read();
  const nombre = paciente.name?.find((n) => n.use === 'official') ?? paciente.name?.[0];
  const dni = paciente.identifier?.find((i) => i.system === SISTEMA_DNI)?.value;

  return (
    <>
      <Box px="xl" pt="xl">
        <Alert variant="light" color="blue" icon={<IconStethoscope size={20} />} title="Vista de médico">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              Estás viendo los estudios de <b>{formatHumanName(nombre) || 'paciente sin nombre'}</b>
              {dni ? ` · DNI ${dni}` : ''}
            </Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => void navigate('/doctor/patients')}
            >
              Volver al listado de pacientes
            </Button>
          </Group>
        </Alert>
      </Box>

      {studyId ? (
        <ImagingStudyDetail key={studyId} patientId={patientId} />
      ) : (
        <ImagingStudies key={patientId} patientId={patientId} />
      )}
    </>
  );
}
