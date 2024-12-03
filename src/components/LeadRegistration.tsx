import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MainHeader from './MainHeader';
import Footer from './Footer';
import { useDataStore } from '../store/useDataStore';

const locations = {
  brasilia: {
    name: 'Brasília',
    units: ['Lago Sul', 'Asa Sul', 'Sudoeste']
  },
  florianopolis: {
    name: 'Florianópolis',
    units: ['Centro', 'Santa Mônica', 'Coqueiros']
  },
  dourados: {
    name: 'Dourados',
    units: ['Centro']
  },
  online: {
    name: 'Online',
    units: ['Online']
  }
};

export default function LeadRegistration() {
  const { addLead, units } = useDataStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    unit: '',
    source: 'form',
    notes: '',
    value: 0
  });
  const [submitted, setSubmitted] = useState(false);

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({
      ...formData,
      city: e.target.value,
      unit: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Encontrar a unidade principal baseada na cidade
    const mainUnit = units.find(u => u.city === locations[formData.city as keyof typeof locations].name);
    
    if (!mainUnit) {
      console.error('Unidade principal não encontrada:', formData.city);
      return;
    }

    // Encontrar a subunidade baseada no nome selecionado
    const selectedSubUnit = mainUnit.subunits?.find(su => su.name === formData.unit);
    
    if (!selectedSubUnit) {
      console.error('Subunidade não encontrada:', formData.unit);
      return;
    }

    addLead({
      ...formData,
      unitId: mainUnit.id,
      notes: `Cidade: ${formData.city}\nUnidade: ${formData.unit}\nSubunidade ID: ${selectedSubUnit.id}`
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-100">
        <MainHeader />
        
        <main className="pt-16">
          <div className="container mx-auto px-4 py-20">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Obrigado pelo interesse!</h2>
              <p className="text-gray-600 mb-8">
                Em breve nossa equipe entrará em contato para agendar sua aula experimental.
              </p>
              <Link
                to="/"
                className="inline-block bg-[#dfa129] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
              >
                Voltar para Home
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section 
          className="relative py-20 md:py-32"
          style={{
            backgroundImage: 'linear-gradient(rgba(48, 48, 48, 0.9), rgba(48, 48, 48, 0.9)), url(https://kihap.com.br/wp-content/uploads/2022/06/kihap-familia-1.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Left Column - Text */}
                <div className="text-white">
                  <h1 className="text-4xl font-bold mb-6">
                    Transforme sua vida através da arte marcial
                  </h1>
                  <p className="text-xl text-gray-300 mb-8">
                    Agende sua aula experimental gratuita e descubra como a arte marcial pode transformar sua vida.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-[#dfa129] rounded-full"></span>
                      <span>Desenvolvimento físico e mental</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-[#dfa129] rounded-full"></span>
                      <span>Autoconfiança e disciplina</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-[#dfa129] rounded-full"></span>
                      <span>Metodologia exclusiva</span>
                    </li>
                  </ul>
                </div>

                {/* Right Column - Form */}
                <div className="bg-white rounded-lg shadow-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Agende sua Experiência
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome completo
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#1d528d] focus:border-transparent"
                        required
                        placeholder="Digite seu nome completo"
                        title="Nome completo"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#1d528d] focus:border-transparent"
                        required
                        placeholder="Digite seu email"
                        title="Email"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#1d528d] focus:border-transparent"
                        required
                        placeholder="Digite seu telefone"
                        title="Telefone"
                      />
                    </div>

                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                        Cidade
                      </label>
                      <select
                        id="city"
                        value={formData.city}
                        onChange={handleCityChange}
                        className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#1d528d] focus:border-transparent"
                        required
                        title="Cidade"
                      >
                        <option value="">Selecione uma cidade</option>
                        {Object.entries(locations).map(([key, { name }]) => (
                          <option key={key} value={key}>{name}</option>
                        ))}
                      </select>
                    </div>

                    {formData.city && locations[formData.city as keyof typeof locations].units.length > 1 && (
                      <div>
                        <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                          Unidade
                        </label>
                        <select
                          id="unit"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#1d528d] focus:border-transparent"
                          required
                          title="Unidade"
                        >
                          <option value="">Selecione uma unidade</option>
                          {locations[formData.city as keyof typeof locations].units.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-[#dfa129] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-opacity-90 transition-colors"
                    >
                      Agendar Experiência
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
              Por que escolher a KIHAP?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-[#dfa129] rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Metodologia Exclusiva</h3>
                <p className="text-gray-600">
                  Sistema de ensino desenvolvido para maximizar seu aprendizado e desenvolvimento.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-[#dfa129] rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Instrutores Qualificados</h3>
                <p className="text-gray-600">
                  Equipe altamente treinada e comprometida com seu desenvolvimento.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-[#dfa129] rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Ambiente Acolhedor</h3>
                <p className="text-gray-600">
                  Espaço preparado para proporcionar a melhor experiência de treino.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
