// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS (etapa 2): listado de pacientes para el medico. GET /Patient paginado, ordenado por apellido, con
// nombre, apellido y DNI (el identificador con el system de RENAPER). Que pacientes ve lo decide la politica de
// Medplum del medico. Un clic marca la fila; doble clic abre los estudios de ese paciente
// (/doctor/patients/{id}/imaging-studies).
//
// Buscador arriba de la tabla. Busca en el SERVIDOR (no filtra la pagina ya traida), 500 ms despues de la ultima
// tecla, y vuelve a la pagina 1. Segun lo escrito:
//   - sin espacios y con algun digito: DNI exacto, identifier=<SISTEMA_DNI>|<texto> (tambien los raros como
//     "556342B", "123-45-6789" o "D97258/11053");
//   - si no: cada palabra como name:contains=<palabra>, parametros repetidos = "y" (tienen que estar todas; contains
//     busca en cualquier parte del nombre o del apellido, sin distinguir mayusculas);
//   - vacio: el listado completo, sin filtro.
// Lo que coincide se resalta en la tabla (Highlight de Mantine).
//
// El input y su estado estan en PatientsList; la busqueda con .read() (que suspende) esta en el hijo Resultados,
// dentro de su propio Suspense, asi al buscar no se desmonta el input (no pierde el foco ni titila). Ademas la
// consulta pasa por useDeferredValue: mientras llega la respuesta nueva se siguen viendo los resultados anteriores
// (atenuados) y la lupa se cambia por un indicador de carga.
//
// No usa el SearchControl de Medplum, como ImagingStudies, porque ahi el DNI saldria como
// "http://www.renaper.gob.ar/dni: 7" y los encabezados en ingles: la tabla se arma a mano con la misma estructura.
import { Box, Center, CloseButton, Highlight, Loader, Pagination, Table, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import type { Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconSearch } from '@tabler/icons-react';
import { Suspense, useDeferredValue, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router';
import { InfoSection } from '../../components/InfoSection';

/** System del DNI: el mismo que usa el sincronizador (paciente.identificador-system). */
const SISTEMA_DNI = 'http://www.renaper.gob.ar/dni';
const POR_PAGINA = 20;
/** Cuanto se espera despues de la ultima tecla antes de buscar (ms). */
const ESPERA_BUSQUEDA = 500;

/** Lo escrito en el buscador, ya interpretado. */
type Criterio = { tipo: 'todos' } | { tipo: 'dni'; dni: string } | { tipo: 'nombre'; palabras: string[] };

/**
 * Interpreta el texto del buscador: sin espacios y con algun digito es un DNI; si no, palabras del nombre.
 * Las comas cuentan como espacios (en FHIR la coma es un "o" y "Perez, Juan" no debe buscar eso).
 */
function interpretar(texto: string): Criterio {
  const limpio = texto.replace(/,/g, ' ').trim();
  if (!limpio) {
    return { tipo: 'todos' };
  }
  if (!/\s/.test(limpio) && /\d/.test(limpio)) {
    return { tipo: 'dni', dni: limpio };
  }
  return { tipo: 'nombre', palabras: limpio.split(/\s+/) };
}

export function PatientsList(): JSX.Element {
  const [texto, setTexto] = useState('');
  const [textoEstable] = useDebouncedValue(texto, ESPERA_BUSQUEDA);
  const busqueda = textoEstable.trim();

  // La pagina vale para una busqueda: si la busqueda cambia, se vuelve a la 1 (sin pedir antes la pagina vieja)
  const [paginaDe, setPaginaDe] = useState({ busqueda: '', pagina: 1 });
  const pagina = paginaDe.busqueda === busqueda ? paginaDe.pagina : 1;

  // Lo que se muestra va "atrasado" (useDeferredValue): mientras carga la consulta nueva quedan los resultados de antes
  const consulta = useMemo(() => ({ busqueda, pagina }), [busqueda, pagina]);
  const mostrada = useDeferredValue(consulta);
  const cargando = consulta !== mostrada;

  return (
    <Box p="xl">
      <Title mb="lg">Pacientes</Title>

      <InfoSection title="Listado de pacientes">
        <TextInput
          mt="md"
          mb="md"
          placeholder="Buscar por nombre, apellido o DNI"
          aria-label="Buscar por nombre, apellido o DNI"
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
          leftSection={cargando ? <Loader size={16} /> : <IconSearch size={16} />}
          rightSection={
            texto ? (
              <CloseButton
                size="sm"
                aria-label="Borrar la búsqueda"
                // El foco se queda en el input
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setTexto('')}
              />
            ) : null
          }
          rightSectionPointerEvents="auto"
        />
        <Box style={{ opacity: cargando ? 0.6 : 1, transition: 'opacity 150ms' }}>
          <Suspense
            fallback={
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            }
          >
            <Resultados
              busqueda={mostrada.busqueda}
              pagina={mostrada.pagina}
              onPagina={(p) => setPaginaDe({ busqueda, pagina: p })}
            />
          </Suspense>
        </Box>
      </InfoSection>
    </Box>
  );
}

interface ResultadosProps {
  readonly busqueda: string;
  readonly pagina: number;
  readonly onPagina: (pagina: number) => void;
}

/** La tabla de pacientes de una busqueda y una pagina. Hace el .read(), asi que suspende mientras carga. */
function Resultados({ busqueda, pagina, onPagina }: ResultadosProps): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [seleccionado, setSeleccionado] = useState<string>();
  const criterio = interpretar(busqueda);

  const abrir = (id: string): void => {
    void navigate(`/doctor/patients/${id}/imaging-studies`);
  };

  // URLSearchParams para poder repetir name:contains (una vez por palabra)
  const parametros = new URLSearchParams({
    _count: String(POR_PAGINA),
    _offset: String((pagina - 1) * POR_PAGINA),
    _sort: 'family',
    _total: 'accurate',
  });
  if (criterio.tipo === 'dni') {
    parametros.append('identifier', `${SISTEMA_DNI}|${criterio.dni}`);
  } else if (criterio.tipo === 'nombre') {
    for (const palabra of criterio.palabras) {
      parametros.append('name:contains', palabra);
    }
  }

  // La promesa se guarda por consulta: al re-renderizar (cada tecla, cada clic en una fila) se reusa la misma, aunque
  // ya haya vencido el cache de 60 s del cliente de Medplum, y la tabla no se vuelve a suspender
  const consulta = parametros.toString();
  const bundle = useMemo(() => medplum.search('Patient', new URLSearchParams(consulta)), [medplum, consulta]).read();

  const pacientes = (bundle.entry ?? []).map((e) => e.resource as Patient);
  const total = bundle.total ?? pacientes.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const resaltarNombre = criterio.tipo === 'nombre' ? criterio.palabras : [];
  const resaltarDni = criterio.tipo === 'dni' ? [criterio.dni] : [];

  if (pacientes.length === 0) {
    return criterio.tipo === 'todos' ? (
      <Text c="dimmed">No hay pacientes.</Text>
    ) : (
      <Text c="dimmed" ta="center" py="lg">
        No hay pacientes que coincidan con «{busqueda}».
      </Text>
    );
  }

  return (
    <>
      {criterio.tipo !== 'todos' && (
        <Text size="sm" c="gray.7" mb={4}>
          {total === 1 ? '1 paciente encontrado' : `${total} pacientes encontrados`}
        </Text>
      )}
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
                <Table.Td>
                  <Resaltado texto={nombre?.given?.join(' ')} buscar={resaltarNombre} />
                </Table.Td>
                <Table.Td>
                  <Resaltado texto={nombre?.family} buscar={resaltarNombre} />
                </Table.Td>
                <Table.Td>
                  <Resaltado texto={dni} buscar={resaltarDni} />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      <Center mt="md">
        <Pagination value={pagina} onChange={onPagina} total={paginas} />
      </Center>
    </>
  );
}

interface ResaltadoProps {
  readonly texto?: string;
  readonly buscar: string[];
}

/** El texto de una celda con lo buscado resaltado en verde suave (sin distinguir mayusculas); '-' si no hay valor. */
function Resaltado({ texto, buscar }: ResaltadoProps): JSX.Element {
  if (!texto || buscar.length === 0) {
    return <>{texto || '-'}</>;
  }
  return (
    <Highlight component="span" inherit highlight={buscar} color="teal.1">
      {texto}
    </Highlight>
  );
}
