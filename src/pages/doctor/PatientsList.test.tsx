// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
//
// MiniPACS: prueba del buscador del listado de pacientes del medico, con el MockClient de Medplum. Verifica los
// parametros que se mandan al servidor (DNI exacto vs name:contains por palabra), el contador, el resaltado, el
// mensaje sin resultados y que el input no se desmonte ni pierda el foco al buscar.
import { MantineProvider } from '@mantine/core';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { PatientsList } from './PatientsList';

const SISTEMA_DNI = 'http://www.renaper.gob.ar/dni';
const PLACEHOLDER = 'Buscar por nombre, apellido o DNI';
const ESPERA = { timeout: 5000 };

/** Los parametros del ultimo medplum.search('Patient', ...) que hizo el componente. */
function ultimaBusqueda(espia: { mock: { calls: unknown[][] } }): URLSearchParams {
  const llamadas = espia.mock.calls.filter((c) => c[0] === 'Patient');
  return llamadas[llamadas.length - 1][1] as URLSearchParams;
}

/** Las partes resaltadas (<mark>) de la tabla. */
function resaltados(): string[] {
  return Array.from(document.querySelectorAll('mark')).map((m) => m.textContent ?? '');
}

test('PatientsList: busca por DNI exacto o por palabras del nombre, en el servidor', async () => {
  const medplum = new MockClient();
  const zapata = await medplum.createResource({
    resourceType: 'Patient',
    name: [{ use: 'official', given: ['Francisco'], family: 'Zapata' }],
    identifier: [{ system: SISTEMA_DNI, value: '35151249' }],
  });
  await medplum.createResource({
    resourceType: 'Patient',
    name: [{ use: 'official', given: ['Juan'], family: 'Perez' }],
  });

  // El MockClient no busca por identifier (el servidor real si): el espia registra los parametros tal como los manda
  // el componente y, para que el mock devuelva algo, traduce el DNI conocido al _id de ese paciente
  const buscar = medplum.search.bind(medplum);
  const espia = vi.spyOn(medplum, 'search').mockImplementation(((tipo, consulta, opciones) => {
    const params = new URLSearchParams(consulta as URLSearchParams);
    const identificador = params.get('identifier');
    if (identificador) {
      params.delete('identifier');
      params.set('_id', identificador === `${SISTEMA_DNI}|35151249` ? zapata.id : 'no-existe');
    }
    return buscar(tipo, params, opciones);
  }) as typeof medplum.search);

  render(
    <MemoryRouter>
      <MedplumProvider medplum={medplum}>
        <MantineProvider>
          <PatientsList />
        </MantineProvider>
      </MedplumProvider>
    </MemoryRouter>
  );

  // Sin buscar: el listado de hoy, sin filtro
  expect(await screen.findByText('Zapata', undefined, ESPERA)).toBeInTheDocument();
  let params = ultimaBusqueda(espia);
  expect(params.get('_sort')).toBe('family');
  expect(params.get('_total')).toBe('accurate');
  expect(params.get('_offset')).toBe('0');
  expect(params.has('identifier')).toBe(false);
  expect(params.has('name:contains')).toBe(false);

  const input = screen.getByPlaceholderText(PLACEHOLDER);
  input.focus();

  // DNI (sin espacios y con digitos): identifier exacto con el system de RENAPER
  fireEvent.change(input, { target: { value: '35151249' } });
  expect(await screen.findByText('1 paciente encontrado', undefined, ESPERA)).toBeInTheDocument();
  params = ultimaBusqueda(espia);
  expect(params.getAll('identifier')).toEqual([`${SISTEMA_DNI}|35151249`]);
  expect(params.has('name:contains')).toBe(false);
  expect(resaltados()).toEqual(['35151249']);

  // El input es el mismo (no se desmonto) y sigue con el foco
  expect(screen.getByPlaceholderText(PLACEHOLDER)).toBe(input);
  expect(document.activeElement).toBe(input);

  // Palabras: una name:contains por palabra (tienen que estar todas)
  fireEvent.change(input, { target: { value: 'juan per' } });
  await waitFor(() => expect(resaltados()).toEqual(['Juan', 'Per']), ESPERA);
  expect(screen.getByText('1 paciente encontrado')).toBeInTheDocument();
  params = ultimaBusqueda(espia);
  expect(params.getAll('name:contains')).toEqual(['juan', 'per']);
  expect(params.has('identifier')).toBe(false);
  expect(params.get('_offset')).toBe('0');
  expect(screen.queryByText('Zapata')).not.toBeInTheDocument();

  // DNI raro (letras y digitos, sin espacios): tambien va como identifier
  fireEvent.change(input, { target: { value: '556342B' } });
  expect(
    await screen.findByText('No hay pacientes que coincidan con «556342B».', undefined, ESPERA)
  ).toBeInTheDocument();
  expect(ultimaBusqueda(espia).getAll('identifier')).toEqual([`${SISTEMA_DNI}|556342B`]);

  // Sin resultados
  fireEvent.change(input, { target: { value: 'gomez' } });
  expect(
    await screen.findByText('No hay pacientes que coincidan con «gomez».', undefined, ESPERA)
  ).toBeInTheDocument();
  expect(ultimaBusqueda(espia).getAll('name:contains')).toEqual(['gomez']);
  expect(document.activeElement).toBe(input);

  // La x borra y vuelve el listado completo
  fireEvent.click(screen.getByLabelText('Borrar la búsqueda'));
  expect(await screen.findByText('Zapata', undefined, ESPERA)).toBeInTheDocument();
  expect(screen.getByText('Perez')).toBeInTheDocument();
  expect(screen.queryByText(/encontrado/)).not.toBeInTheDocument();
});
