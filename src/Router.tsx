// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { useMedplumProfile } from '@medplum/react';
import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AccountPage } from './pages/account';
// import { MembershipAndBilling } from './pages/account/MembershipAndBilling'; // MiniPACS (etapa 1): solo el perfil
import { Profile } from './pages/account/Profile';
// import { Provider } from './pages/account/Provider'; // MiniPACS (etapa 1): solo el perfil
import { CarePlanPage } from './pages/care-plan';
import { ActionItem } from './pages/care-plan/ActionItem';
import { ActionItems } from './pages/care-plan/ActionItems';
import { GetCare } from './pages/GetCarePage';
import { HealthRecord } from './pages/health-record';
import { ImagingStudies } from './pages/health-record/ImagingStudies';
import { ImagingStudyDetail } from './pages/health-record/ImagingStudyDetail';
// MiniPACS (etapa 1): en Health Record solo queda Imaging Studies
// import { LabResult } from './pages/health-record/LabResult';
// import { LabResults } from './pages/health-record/LabResults';
// import { Measurement } from './pages/health-record/Measurement';
// import { Medication } from './pages/health-record/Medication';
// import { Medications } from './pages/health-record/Medications';
// import { Response } from './pages/health-record/Response';
// import { Responses } from './pages/health-record/Responses';
// import { Vaccine } from './pages/health-record/Vaccine';
// import { Vaccines } from './pages/health-record/Vaccines';
// import { Vitals } from './pages/health-record/Vitals';
import { DoctorLayout } from './pages/doctor';
import { PatientsList } from './pages/doctor/PatientsList';
import { PatientStudiesPage } from './pages/doctor/PatientStudiesPage';
// import { HomePage } from './pages/HomePage'; // MiniPACS: "/" lleva a la seccion de cada perfil
import { MessagesPage } from './pages/MessagesPage';
import { ObservationPage } from './pages/ObservationPage';
import { PatientIntakeQuestionnairePage } from './pages/PatientIntakeQuestionnairePage';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { ScreeningQuestionnairePage } from './pages/ScreeningQuestionnairePage';
import { SignOutPage } from './pages/SignOutPage';
import { SmartHealthLinksPage } from './pages/SmartHealthLinksPage';

export function Router(): JSX.Element {
  // MiniPACS (etapa 1): el Router solo se muestra con alguien logueado (App.tsx). Aca se lee el perfil UNA vez y se
  // pasa el id a las paginas de estudios, que no saben quien entro. Estas rutas suponen un Patient; con el medico
  // (etapa 2) cada uno va a su seccion segun el tipo de perfil.
  const profile = useMedplumProfile();
  const patientId = profile?.id ?? '';

  // MiniPACS (etapa 2): a donde va cada uno al entrar, segun el tipo de perfil
  const initialPath = profile?.resourceType === 'Practitioner' ? '/doctor/patients' : '/health-record/imaging-studies';

  return (
    <Routes>
      {/* MiniPACS: la pagina de inicio de Foo Medical se reemplaza por la seccion de cada perfil
      <Route path="/" element={<HomePage />} />
      */}
      <Route path="/" element={<Navigate replace to={initialPath} />} />
      <Route path="doctor" element={<DoctorLayout />}>
        <Route index element={<Navigate replace to="/doctor/patients" />} />
        <Route path="patients" element={<PatientsList />} />
        <Route path="patients/:patientId/imaging-studies" element={<PatientStudiesPage />} />
        <Route path="patients/:patientId/imaging-studies/:studyId" element={<PatientStudiesPage />} />
      </Route>
      <Route path="Communication" element={<MessagesPage />}>
        <Route path=":messageId" element={<MessagesPage />} />
      </Route>
      <Route path="Questionnaire/:questionnaireId" element={<QuestionnairePage />} />
      <Route path="screening-questionnaire" element={<ScreeningQuestionnairePage />} />
      <Route path="patient-intake-questionnaire" element={<PatientIntakeQuestionnairePage />} />
      <Route path="health-record" element={<HealthRecord />}>
        <Route index element={<Navigate replace to="/health-record/imaging-studies" />} />
        <Route path="imaging-studies" element={<ImagingStudies patientId={patientId} />} />
        <Route path="imaging-studies/:studyId" element={<ImagingStudyDetail patientId={patientId} />} />
        {/* MiniPACS (etapa 1): el resto de Health Record no se usa
        <Route path="lab-results" element={<LabResults />} />
        <Route path="lab-results/:resultId" element={<LabResult />} />
        <Route path="medications" element={<Medications />} />
        <Route path="medications/:medicationId" element={<Medication />} />
        <Route path="questionnaire-responses" element={<Responses />} />
        <Route path="questionnaire-responses/:responseId" element={<Response />} />
        <Route path="vaccines" element={<Vaccines />} />
        <Route path="vaccines/:vaccineId" element={<Vaccine />} />
        <Route path="vitals" element={<Vitals />} />
        <Route path="vitals/:measurementId" element={<Measurement />} />
        */}
      </Route>
      <Route path="Observation/:observationId" element={<ObservationPage />} />
      <Route path="care-plan" element={<CarePlanPage />}>
        <Route index element={<Navigate replace to="/care-plan/action-items" />} />
        <Route path="action-items" element={<ActionItems />} />
        <Route path="action-items/:itemId" element={<ActionItem />} />
      </Route>
      <Route path="get-care" element={<GetCare />} />
      <Route path="smart-health-links" element={<SmartHealthLinksPage />} />
      <Route path="account" element={<AccountPage />}>
        <Route index element={<Navigate replace to="/account/profile" />} />
        <Route path="profile" element={<Profile />} />
        {/* MiniPACS (etapa 1): en la cuenta solo queda el perfil
        <Route path="provider" element={<Provider />} />
        <Route path="membership-and-billing" element={<MembershipAndBilling />} />
        */}
      </Route>
      <Route path="signout" element={<SignOutPage />} />
    </Routes>
  );
}
