// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS (etapa 2): listado de pacientes para el medico. GET /Patient paginado, ordenado por apellido, con
// nombre, apellido y DNI (el identificador con el system de RENAPER). Que pacientes ve lo decide la politica de
// Medplum del medico. Un clic marca la fila; doble clic abre los estudios de ese paciente
// (/doctor/patients/{id}/imaging-studies).
//
// No usa el SearchControl de Medplum, como ImagingStudies, porque ahi el DNI saldria como
// "http://www.renaper.gob.ar/dni: 7" y los encabezados en ingles: la tabla se arma a mano con la misma estructura.
import { Box, Center, Pagination, Table, Text, Title } from '@mantine/core';
import type { Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router';
import { InfoSection } from '../../components/InfoSection';

/** System del DNI: el mismo que usa el sincronizador (paciente.identificador-system). */
const SISTEMA_DNI = 'http://www.renaper.gob.ar/dni';
const POR_PAGINA = 20;

export function PatientsList(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<string>();

  const abrir = (id: string): void => {
    void navigate(`/doctor/patients/${id}/imaging-studies`);
  };

  const bundle = medplum
    .search('Patient', {
      _count: String(POR_PAGINA),
      _offset: String((pagina - 1) * POR_PAGINA),
      _sort: 'family',
      _total: 'accurate',
    })
    .read();

  const pacientes = (bundle.entry ?? []).map((e) => e.resource as Patient);
  const paginas = Math.max(1, Math.ceil((bundle.total ?? pacientes.length) / POR_PAGINA));

  return (
    <Box p="xl">
      <Title mb="lg">Pacientes</Title>

      <InfoSection title="Listado de pacientes">
        {pacientes.length === 0 ? (
          <Text c="dimmed">No hay pacientes.</Text>
        ) : (
          <>
            <Text size="sm" c="dimmed" mb="sm">
              Un clic para marcar un paciente; doble clic para ver sus estudios.
            </Text>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Apellido</Table.Th>
                  <Table.Th>DNI</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pacientes.map((paciente) => {
                  const nombre = paciente.name?.find((n) => n.use === 'official') ?? paciente.name?.[0];
                  const dni = paciente.identifier?.find((i) => i.system === SISTEMA_DNI)?.value;
                  const id = paciente.id as string;
                  const marcado = seleccionado === id;
                  return (
                    <Table.Tr
                      key={id}
                      onClick={() => setSeleccionado(id)}
                      onDoubleClick={() => abrir(id)}
                      bg={marcado ? 'var(--mantine-primary-color-light)' : undefined}
                      fw={marcado ? 600 : undefined}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      aria-selected={marcado}
                    >
                      <Table.Td>{nombre?.given?.join(' ') || '-'}</Table.Td>
                      <Table.Td>{nombre?.family || '-'}</Table.Td>
                      <Table.Td>{dni || '-'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            <Center mt="md">
              <Pagination value={pagina} onChange={setPagina} total={paginas} />
            </Center>
          </>
        )}
      </InfoSection>
    </Box>
  );
}
