import type { Provider } from '../types'

export const providers: Provider[] = [
  {
    id: 'desert-skin', name: 'Dr. Maya Patel', practice: 'Desert Skin Clinic', specialty: 'Dermatology',
    address: '7420 E Bell Rd, Scottsdale, AZ', distance: 2.1, rating: 4.8, nextAvailable: 'Tomorrow, 10:30 AM',
    negotiatedRate: 148, facilityFee: 0, networkStatus: 'confirmed', acceptingNewPatients: true,
    languages: ['English', 'Hindi'],
  },
  {
    id: 'valley-derm', name: 'Dr. Elena Ruiz', practice: 'Valley Dermatology', specialty: 'Dermatology',
    address: '16601 N 40th St, Phoenix, AZ', distance: 4.5, rating: 4.9, nextAvailable: 'Wed, Sep 16',
    negotiatedRate: 185, facilityFee: 0, networkStatus: 'confirmed', acceptingNewPatients: true,
    languages: ['English', 'Spanish'],
  },
  {
    id: 'sonoran-med', name: 'Dr. Marcus Lee', practice: 'Sonoran Medical Dermatology', specialty: 'Dermatology',
    address: '10290 N 92nd St, Scottsdale, AZ', distance: 6.8, rating: 4.6, nextAvailable: 'Fri, Sep 18',
    negotiatedRate: 132, facilityFee: 35, networkStatus: 'likely', acceptingNewPatients: true,
    languages: ['English', 'Mandarin'],
  },
  {
    id: 'city-hospital', name: 'Dr. Sarah Chen', practice: 'City Hospital Dermatology', specialty: 'Dermatology',
    address: '250 E Dunlap Ave, Phoenix, AZ', distance: 8.2, rating: 4.7, nextAvailable: 'Mon, Sep 21',
    negotiatedRate: 175, facilityFee: 95, networkStatus: 'confirmed', acceptingNewPatients: true,
    languages: ['English'],
  },
  {
    id: 'north-cardio', name: 'Dr. Amir Hassan', practice: 'North Valley Heart', specialty: 'Cardiology',
    address: '13840 N Tatum Blvd, Phoenix, AZ', distance: 3.7, rating: 4.8, nextAvailable: 'Thu, Sep 17',
    negotiatedRate: 225, facilityFee: 0, networkStatus: 'confirmed', acceptingNewPatients: true,
    languages: ['English', 'Arabic'],
  },
  {
    id: 'family-first', name: 'Dr. Noah Williams', practice: 'Family First Care', specialty: 'Primary care',
    address: '7000 E Mayo Blvd, Phoenix, AZ', distance: 1.9, rating: 4.7, nextAvailable: 'Today, 3:00 PM',
    negotiatedRate: 105, facilityFee: 0, networkStatus: 'confirmed', acceptingNewPatients: true,
    languages: ['English'],
  },
]

export const specialties = ['Dermatology', 'Primary care', 'Cardiology']
