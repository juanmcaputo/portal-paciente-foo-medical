// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS (etapa 1): detalle de un ImagingStudy en lenguaje simple: estado, fecha, modalidades, cantidades, series
// y el boton "Ver estudio".
// Recibe patientId por propiedad y toma el studyId de la ruta; sirve para el paciente y el medico.
// La seguridad la pone la politica de Medplum; el control de pertenencia de abajo es solo para la pantalla.
//
// "Ver estudio", con el servicio de pase (Documentacion/SERVICIO_PASE/SERVICIO_PASE.md):
//   - paciente (MINIPACS_PASE_URL) o medico (MINIPACS_PASE_URL_MEDICO): pide al servicio un codigo de un solo uso
//     (POST /pase con el token de Medplum y el StudyInstanceUID) y abre <puerta>/entrar?codigo=... : el visor se
//     abre sin usuario ni contrasenia. El paciente ve solo ese estudio; el medico, el OHIF completo;
//   - sin la variable de su perfil: abre la direccion del Endpoint del estudio (OHIF con login de Keycloak).
import { Alert, Badge, Box, Button, Card, Divider, Group, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import type { Endpoint, ImagingStudy, ImagingStudySeries } from '@medplum/fhirtypes';
import { useMedplum, useResource } from '@medplum/react';
import { IconExternalLink, IconFileText, IconStack2 } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

/** Zona del centro: la misma con la que el sincronizador arma las fechas (estudio.zona-horaria). */
const ZONA_DEL_CENTRO = 'America/Argentina/Buenos_Aires';

/** Puertas del servicio de pase (OHIF y servicio en el mismo origen), sin barra al final. Vacia: sin pase. */
const PUERTA_PACIENTE: string = String(import.meta.env.MINIPACS_PASE_URL ?? '').replace(/\/+$/, '');
const PUERTA_MEDICO: string = String(import.meta.env.MINIPACS_PASE_URL_MEDICO ?? '').replace(/\/+$/, '');

/** Lo que muestra la pestania nueva mientras se pide el pase (tarda unos segundos). Texto fijo, sin datos. */
function mostrarEspera(pestania: Window): void {
  const doc = pestania.document;
  doc.title = 'Abriendo el estudio...';
  doc.body.style.cssText =
    'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
    'font-family:system-ui,sans-serif;background:#f8f9fa;color:#343a40';
  doc.body.innerHTML =
    '<style>@keyframes girar{to{transform:rotate(360deg)}}</style>' +
    '<div style="text-align:center">' +
    '<div style="width:40px;height:40px;margin:0 auto 1rem;border:4px solid #dee2e6;border-top-color:#228be6;' +
    'border-radius:50%;animation:girar 1s linear infinite"></div>' +
    '<p style="font-size:1.4rem;margin:0 0 .5rem">Abriendo el estudio...</p>' +
    '<p style="margin:0;color:#868e96">Estamos preparando el visor. Puede tardar unos segundos.</p>' +
    '</div>';
}

const ESTADOS: Record<string, { texto: string; color: string }> = {
  available: { texto: 'Disponible', color: 'green' },
  registered: { texto: 'Registrado', color: 'blue' },
  cancelled: { texto: 'Cancelado', color: 'red' },
  'entered-in-error': { texto: 'Anulado', color: 'red' },
  unknown: { texto: 'Desconocido', color: 'gray' },
};

/** Nombre simple de la modalidad DICOM; si no esta en la lista, "Modalidad XX". */
const MODALIDADES: Record<string, string> = {
  SR: 'Documento estructurado DICOM (SR)',
  CT: 'Tomografia computada (CT)',
  MR: 'Resonancia magnetica (MR)',
  US: 'Ecografia (US)',
  CR: 'Radiografia (CR)',
  DX: 'Radiografia digital (DX)',
  MG: 'Mamografia (MG)',
  XA: 'Angiografia (XA)',
  NM: 'Medicina nuclear (NM)',
  PT: 'PET (PT)',
};

interface ImagingStudyDetailProps {
  readonly patientId: string;
}

export function ImagingStudyDetail({ patientId }: ImagingStudyDetailProps): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { studyId = '' } = useParams();

  // Recuperar el ImagingStudy seleccionado
  const study: ImagingStudy = medplum.readResource('ImagingStudy', studyId).read();

  // El Endpoint (visor OHIF) se lee aparte: si no se puede leer, el boton queda deshabilitado
  const visor = useResource<Endpoint>(study.endpoint?.[0]);

  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string>();

  // Verificar que el estudio pertenece al paciente
  const patientReference = `Patient/${patientId}`;
  const subjectReference = study.subject.reference;
  if (subjectReference !== patientReference && !subjectReference?.endsWith(`/${patientReference}`)) {
    return <Alert color="red">Este estudio no corresponde al paciente seleccionado.</Alert>;
  }

  const estado = ESTADOS[study.status] ?? ESTADOS.unknown;
  const modalidades = (study.modality ?? []).map((m) => m.code).filter((c): c is string => !!c);
  const series = study.series ?? [];

  // Con servicio de pase: el boton pide un pase y abre el visor sin login (cada perfil por su puerta)
  const perfil = medplum.getProfile()?.resourceType;
  const puerta = perfil === 'Patient' ? PUERTA_PACIENTE : perfil === 'Practitioner' ? PUERTA_MEDICO : '';
  const conPase = puerta !== '';
  const uid = study.identifier?.find((i) => i.system === 'urn:dicom:uid')?.value?.replace(/^urn:oid:/, '');

  async function verConPase(): Promise<void> {
    // La pestania se abre en el mismo clic: si se abriera despues de pedir el pase, el navegador la bloquea
    const pestania = window.open('', '_blank');
    if (pestania) {
      pestania.opener = null;
      mostrarEspera(pestania);
    }
    setAbriendo(true);
    setError(undefined);
    try {
      await medplum.refreshIfExpired();
      const respuesta = await fetch(`${puerta}/pase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${medplum.getAccessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudio: uid }),
      });
      if (!respuesta.ok) {
        throw new Error(`${respuesta.status} ${await respuesta.text()}`);
      }
      const { codigo } = (await respuesta.json()) as { codigo: string };
      const destino = `${puerta}/entrar?codigo=${encodeURIComponent(codigo)}`;
      if (pestania) {
        pestania.location.href = destino;
      } else {
        window.location.href = destino;
      }
    } catch (e) {
      pestania?.close();
      setError(`No se pudo abrir el estudio (${e instanceof Error ? e.message : String(e)}). Proba de nuevo.`);
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <Box p="xl">
      <Button variant="subtle" mb="md" onClick={() => void navigate('..', { relative: 'path' })}>
        ← Volver a estudios
      </Button>

      <Card withBorder radius="md" p="xl">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" mb={4}>
              Historial médico / Estudios de imágenes
            </Text>
            <Title order={3}>{study.description || 'Estudio de diagnóstico por imágenes'}</Title>
          </div>
          <Badge color={estado.color} variant="light" size="lg">
            {estado.texto}
          </Badge>
        </Group>

        <Divider my="lg" />

        <SimpleGrid cols={2} spacing="lg">
          <Dato titulo="Fecha del estudio" valor={fechaHora(study.started) ?? 'No informada'} />
          <Dato titulo="Modalidades" valor={modalidades.length > 0 ? modalidades.join(' · ') : 'No informadas'} />
          <Dato titulo="Series" valor={String(study.numberOfSeries ?? series.length)} />
          <Dato titulo="Instancias DICOM" valor={study.numberOfInstances !== undefined ? String(study.numberOfInstances) : 'No informadas'} />
        </SimpleGrid>

        <Divider my="lg" />

        <Title order={4} mb="md">
          Contenido del estudio
        </Title>
        {series.length === 0 ? (
          <Text c="dimmed">Sin series informadas.</Text>
        ) : (
          <Card withBorder radius="md" p={0}>
            {series.map((serie, i) => (
              <Serie key={serie.uid} serie={serie} numero={i + 1} primera={i === 0} />
            ))}
          </Card>
        )}

        <Group justify="flex-end" mt="xl">
          {conPase ? (
            <Button
              onClick={() => void verConPase()}
              loading={abriendo}
              leftSection={<IconExternalLink size={16} />}
              disabled={!uid}
            >
              Ver estudio
            </Button>
          ) : (
            <Button
              component="a"
              href={visor?.address}
              target="_blank"
              rel="noopener noreferrer"
              leftSection={<IconExternalLink size={16} />}
              disabled={!visor?.address}
            >
              Ver estudio
            </Button>
          )}
        </Group>
        {error && (
          <Alert color="red" mt="md">
            {error}
          </Alert>
        )}
      </Card>
    </Box>
  );
}

function Dato({ titulo, valor }: { readonly titulo: string; readonly valor: string }): JSX.Element {
  return (
    <div>
      <Text size="sm" c="dimmed">
        {titulo}
      </Text>
      <Text size="lg" fw={500}>
        {valor}
      </Text>
    </div>
  );
}

interface SerieProps {
  readonly serie: ImagingStudySeries;
  readonly numero: number;
  readonly primera: boolean;
}

function Serie({ serie, numero, primera }: SerieProps): JSX.Element {
  const codigo = serie.modality?.code ?? '';
  const modalidad = MODALIDADES[codigo] ?? `Modalidad ${codigo}`;
  const n = serie.numberOfInstances;
  const instancias = n === undefined ? undefined : `${n} ${n === 1 ? 'instancia' : 'instancias'}`;
  const cuando = fechaHora(serie.started);
  // Con fecha: modalidad arriba y "fecha · hora · instancias" abajo; sin fecha: "modalidad · instancias"
  const linea1 = cuando ? modalidad : [modalidad, instancias].filter(Boolean).join(' · ');
  const linea2 = cuando ? [cuando, instancias].filter(Boolean).join(' · ') : undefined;

  return (
    <Group
      wrap="nowrap"
      align="flex-start"
      gap="md"
      p="md"
      style={primera ? undefined : { borderTop: '1px solid var(--mantine-color-gray-3)' }}
    >
      <ThemeIcon variant="transparent" color="gray" mt={2}>
        {codigo === 'SR' ? <IconFileText size={20} /> : <IconStack2 size={20} />}
      </ThemeIcon>
      <div>
        <Text fw={600}>
          Serie {numero}
          {serie.description ? ` — ${serie.description}` : ''}
        </Text>
        <Text size="sm" c="dimmed">
          {linea1}
        </Text>
        {linea2 && (
          <Text size="sm" c="dimmed">
            {linea2}
          </Text>
        )}
      </div>
    </Group>
  );
}

/**
 * Fecha (y hora si la hay) en la zona del centro: "26/09/2026 · 14:27". Una fecha sola ("2026-09-26") se arma a mano,
 * porque new Date() la toma como medianoche UTC y en Argentina daria el dia anterior.
 */
function fechaHora(valor: string | undefined): string | undefined {
  if (!valor) {
    return undefined;
  }
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soloFecha) {
    return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
  }
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA_DEL_CENTRO });
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA_DEL_CENTRO });
  return `${fecha} · ${hora}`;
}
