// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  Box,
  Button,
  Card,
  Divider,
  Group,
  InputLabel,
  LoadingOverlay,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { formatAddress, formatFamilyName, formatGivenName, formatHumanName, normalizeErrorString } from '@medplum/core';
import type { HumanName, Patient } from '@medplum/fhirtypes';
import { AddressInput, Form, ResourceAvatar, useMedplum } from '@medplum/react';
import { IconCircleCheck, IconCircleOff } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { InfoSection } from '../../components/InfoSection';

/**
 * MiniPACS (etapa 1): el perfil se ve pero no se edita. Los datos del paciente vienen del PACS (sincronizador) y la
 * politica "MiniPACS - Paciente" es de solo lectura: guardar daria "Forbidden". Para volver a permitirlo: false.
 */
const SOLO_LECTURA = true;

export function Profile(): JSX.Element | null {
  const medplum = useMedplum();
  const [profile, setProfile] = useState(medplum.getProfile() as Patient);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState(profile.address?.[0] || {});

  async function handleProfileEdit(formData: Record<string, string>): Promise<void> {
    setLoading(true);
    const newProfile: Patient = {
      ...profile,
      name: [
        {
          use: 'official',
          given: [formData.givenName],
          family: formData.familyName,
        },
      ],
      birthDate: formData.birthDate,
      gender: formData.gender as Patient['gender'],
      address: [address],
    };
    const updatedProfile = await medplum
      .updateResource(newProfile)
      .then((profile) => {
        showNotification({
          icon: <IconCircleCheck />,
          title: 'Success',
          message: 'Profile edited',
        });
        window.scrollTo(0, 0);
        return profile;
      })
      .catch((err) => {
        showNotification({
          color: 'red',
          icon: <IconCircleOff />,
          title: 'Error',
          message: normalizeErrorString(err),
        });
      });
    if (updatedProfile) {
      setProfile(updatedProfile);
    }
    setLoading(false);
  }

  if (SOLO_LECTURA) {
    return <PerfilSoloLectura profile={profile} />;
  }

  return (
    <Box p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      <Form onSubmit={handleProfileEdit}>
        <Stack align="center">
          <ResourceAvatar size={200} radius={100} value={profile} />
          <Title order={2}>{formatHumanName(profile.name?.[0])}</Title>
          <InfoSection title="Personal Information">
            <Box p="xl">
              <Stack>
                <TextInput
                  label="First Name"
                  name="givenName"
                  defaultValue={formatGivenName(profile.name?.[0] as HumanName)}
                />
                <TextInput
                  label="Last Name"
                  name="familyName"
                  defaultValue={formatFamilyName(profile.name?.[0] as HumanName)}
                />
                <NativeSelect
                  label="Gender"
                  name="gender"
                  defaultValue={profile.gender}
                  data={['', 'female', 'male', 'other', 'unknown']}
                />
                <TextInput label="Birth Date" name="birthDate" type="date" defaultValue={profile.birthDate} />
                <Button type="submit" mr="auto">
                  Save
                </Button>
              </Stack>
            </Box>
          </InfoSection>
          <InfoSection title="Contact Information">
            <Box p="xl">
              <Stack>
                <TextInput
                  label="Email"
                  name="email"
                  defaultValue={profile.telecom?.find((t) => t.system === 'email')?.value}
                  disabled
                />
                <Stack gap={0}>
                  <InputLabel htmlFor="address">Address</InputLabel>
                  <AddressInput
                    name="address"
                    path="Patient.address"
                    defaultValue={address}
                    onChange={(address) => setAddress(address)}
                  />
                </Stack>
                <Button type="submit" mr="auto">
                  Save
                </Button>
              </Stack>
            </Box>
          </InfoSection>
        </Stack>
      </Form>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// MiniPACS (etapa 1): perfil en solo lectura, en espanol, con el mismo estilo que el detalle del estudio.

/** System del DNI: el mismo que usa el sincronizador (paciente.identificador-system). */
const SISTEMA_DNI = 'http://www.renaper.gob.ar/dni';

const SEXOS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
  unknown: 'Desconocido',
};

function PerfilSoloLectura({ profile }: { readonly profile: Patient }): JSX.Element {
  const medplum = useMedplum();
  // El email del paciente es el de su cuenta (con el que entra), no un dato del Patient: sale de /auth/me
  const [emailCuenta, setEmailCuenta] = useState<string>();
  useEffect(() => {
    medplum
      .get('auth/me')
      .then((me: { user?: { email?: string } }) => setEmailCuenta(me.user?.email))
      .catch(console.error);
  }, [medplum]);

  const nombre = profile.name?.find((n) => n.use === 'official') ?? profile.name?.[0];
  const email = emailCuenta ?? profile.telecom?.find((t) => t.system === 'email')?.value;
  const dni = profile.identifier?.find((i) => i.system === SISTEMA_DNI)?.value;
  const direccion = profile.address?.[0] ? formatAddress(profile.address[0]) : '';

  return (
    <Box p="xl">
      <Stack align="center" mb="xl">
        <ResourceAvatar size={120} radius={60} value={profile} />
        <Title order={2}>{formatHumanName(nombre)}</Title>
      </Stack>

      <Card withBorder radius="md" p="xl">
        <Title order={4} mb="md">
          Datos personales
        </Title>
        <SimpleGrid cols={2} spacing="lg">
          <Dato titulo="Nombre" valor={nombre ? formatGivenName(nombre) : ''} />
          <Dato titulo="Apellido" valor={nombre ? formatFamilyName(nombre) : ''} />
          <Dato titulo="DNI" valor={dni} />
          <Dato titulo="Sexo" valor={profile.gender ? SEXOS[profile.gender] : ''} />
          <Dato titulo="Fecha de nacimiento" valor={fecha(profile.birthDate)} />
        </SimpleGrid>

        <Divider my="lg" />

        <Title order={4} mb="md">
          Contacto
        </Title>
        <SimpleGrid cols={2} spacing="lg">
          <Dato titulo="Email" valor={email} />
          <Dato titulo="Dirección" valor={direccion} />
        </SimpleGrid>

        <Group mt="xl">
          <Text size="sm" c="dimmed">
            Estos datos vienen del centro de salud. Si algo no es correcto, avisá en la recepción.
          </Text>
        </Group>
      </Card>
    </Box>
  );
}

function Dato({ titulo, valor }: { readonly titulo: string; readonly valor?: string }): JSX.Element {
  return (
    <div>
      <Text size="sm" c="dimmed">
        {titulo}
      </Text>
      <Text size="lg" fw={500} c={valor ? undefined : 'dimmed'}>
        {valor || 'No informado'}
      </Text>
    </div>
  );
}

/** "1901-01-01" -> "01/01/1901". Se arma a mano para que no cambie el dia por la zona horaria. */
function fecha(valor: string | undefined): string | undefined {
  const partes = valor ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor) : null;
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
}
